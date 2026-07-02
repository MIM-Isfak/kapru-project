import { NextResponse } from 'next/server';
import { ai, GEMINI_MODEL, SYSTEM_PROMPT } from '@/lib/gemini';
import { getMcpClient, getMcpToolsAsGeminiDeclarations } from '@/lib/mcp-client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ChatMessage, Product } from '@/lib/types';
import type { Content, Part, FunctionResponse, FunctionCall } from '@google/genai';
import { determineStage } from '@/lib/agent-stages';

// Type for raw MCP callTool result
type McpToolResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt >= 1) throw error;
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const status = (error as any)?.status;
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempt++;
      } else {
        throw error;
      }
    }
  }
}

// ─── Product shape helpers ────────────────────────────────────────────────────

type KaprukaItem = {
  id?: unknown;
  name?: unknown;
  price?: { amount?: number };
  compare_at_price?: { amount?: number };
  images?: string[];
  image_url?: string;
  rating?: unknown;
  category?: { name?: string };
  in_stock?: boolean;
  summary?: string;
  description?: string;
  url?: string;
};

function mapKaprukaItemToProduct(item: KaprukaItem, isSingleProduct: boolean): Product {
  return {
    id: String(item.id ?? Math.random().toString(36).substring(2, 9)),
    name: String(item.name ?? ''),
    price: item.price?.amount ?? 0,
    originalPrice: item.compare_at_price?.amount ?? undefined,
    image: isSingleProduct
      ? (item.images?.[0] ?? '')
      : (item.image_url ?? ''),
    rating: typeof item.rating === 'number' ? item.rating : 4.0,
    category: item.category?.name ?? 'General',
    inStock: item.in_stock ?? true,
    description: item.summary ?? item.description ?? '',
    url: item.url,
  };
}

function extractProductsFromToolResult(toolName: string, rawResult: McpToolResult): Product[] {
  const products: Product[] = [];
  try {
    // MCP wraps the response as: { content: [{ type: 'text', text: '<json string>' }] }
    const textContent: string | undefined = rawResult?.content?.[0]?.text;
    if (!textContent) return products;

    const parsed = JSON.parse(textContent);

    if (toolName === 'kapruka_search_products') {
      if (Array.isArray(parsed.results)) {
        for (const item of parsed.results) {
          products.push(mapKaprukaItemToProduct(item, false));
        }
      }
    } else if (toolName === 'kapruka_get_product') {
      if (parsed.name) {
        products.push(mapKaprukaItemToProduct(parsed, true));
      }
    }
  } catch {
    // Silently skip if parsing fails or shape doesn't match
  }
  return products;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let mcpClient: Client | null = null;
  try {
    const { messages } = await req.json() as { messages: ChatMessage[] };

    mcpClient = await getMcpClient();
    const toolDeclarations = await getMcpToolsAsGeminiDeclarations(mcpClient);

    const contents: Content[] = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    let finalResponseText = '';
    const products: Product[] = [];
    const allFunctionCalls: FunctionCall[] = [];

    let iterations = 0;
    while (iterations < 5) {
      iterations++;

      const config: Record<string, unknown> = {
        systemInstruction: SYSTEM_PROMPT,
      };

      if (toolDeclarations.length > 0) {
        config.tools = [{ functionDeclarations: toolDeclarations }];
      }

      const response = await withRetry(() => ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config
      }));

      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        finalResponseText = response.text || '';
        break;
      }

      allFunctionCalls.push(...functionCalls);

      // Add the model's function-call turn
      contents.push({
        role: 'model',
        parts: functionCalls.map(call => ({ functionCall: call }))
      });

      const toolResponseParts: Part[] = [];

      for (const call of functionCalls) {
        if (!call.name) continue;
        const toolName = call.name; // narrowed to string

        // TASK 1: Force response_format: 'json' inside params if params is an object
        const rawArgs = (call.args ?? {}) as Record<string, unknown>;
        const callArgs: Record<string, unknown> =
          rawArgs.params && typeof rawArgs.params === 'object' && !Array.isArray(rawArgs.params)
            ? {
                ...rawArgs,
                params: {
                  ...(rawArgs.params as Record<string, unknown>),
                  response_format: 'json',
                },
              }
            : rawArgs;

        let toolResult: McpToolResult | { error: string };
        try {
          console.log(`[Chat API] Invoking tool: ${toolName}`, JSON.stringify(callArgs));
          const result = await withRetry(() => mcpClient!.callTool({
            name: toolName,
            arguments: callArgs,
          })) as McpToolResult;
          toolResult = result;

          // Extract products from search and get_product tool results
          const extracted = extractProductsFromToolResult(toolName, result);
          products.push(...extracted);
        } catch (e: unknown) {
          toolResult = { error: e instanceof Error ? e.message : String(e) };
        }

        const functionResponse: FunctionResponse = {
          name: toolName,
          response: { result: toolResult } as Record<string, unknown>,
        };

        if (call.id) {
          functionResponse.id = call.id;
        }

        toolResponseParts.push({ functionResponse });
      }

      // Add the user's function-response turn
      contents.push({
        role: 'user',
        parts: toolResponseParts,
      });
    }

    const stage = determineStage(allFunctionCalls, finalResponseText, messages);
    return NextResponse.json({ reply: finalResponseText, products, stage });

  } catch (error: unknown) {
    console.error('Chat API FULL error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    const errObj = error as any;
    console.error('Error status:', errObj?.status || errObj?.response?.status);

    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const status = errObj?.status || errObj?.response?.status;

    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted') || status === 429) {
      return NextResponse.json(
        { error: "I'm getting a lot of requests right now — please wait a few seconds and try again." },
        { status: 429 }
      );
    }

    if (msg.includes('401') || msg.includes('403') || msg.includes('key') || msg.includes('auth') || status === 401 || status === 403) {
      console.error('API KEY INVALID OR MISSING');
      return NextResponse.json(
        { error: "There's a configuration issue on our end — please contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Something went wrong, please try again.' },
      { status: 500 }
    );
  } finally {
    if (mcpClient) {
      try {
        const closeable = mcpClient as { close?: () => Promise<void> };
        await closeable.close?.();
      } catch (e: unknown) {
        console.error('Failed to close MCP client', e);
      }
    }
  }
}
