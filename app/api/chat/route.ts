import { NextResponse } from 'next/server';
import { ai, GEMINI_MODEL, SYSTEM_PROMPT } from '@/lib/gemini';
import { getMcpClient, getMcpToolsAsGeminiDeclarations } from '@/lib/mcp-client';
import type { ChatMessage, Product } from '@/lib/types';
import type { Content, Part, FunctionResponse } from '@google/genai';

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= 3) throw error;
      const msg = error?.message?.toLowerCase() || String(error).toLowerCase();
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('resource_exhausted')) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        attempt++;
      } else {
        throw error;
      }
    }
  }
}

// ─── Product shape helpers ────────────────────────────────────────────────────

function mapKaprukaItemToProduct(item: any, isSingleProduct: boolean): Product {
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

function extractProductsFromToolResult(toolName: string, rawResult: any): Product[] {
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
  let mcpClient: any = null;
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

    let iterations = 0;
    while (iterations < 5) {
      iterations++;

      const config: any = {
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

      // Add the model's function-call turn
      contents.push({
        role: 'model',
        parts: functionCalls.map(call => ({ functionCall: call }))
      });

      const toolResponseParts: Part[] = [];

      for (const call of functionCalls) {
        if (!call.name) continue;

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

        let toolResult;
        try {
          const result = await withRetry(() => mcpClient.callTool({
            name: call.name,
            arguments: callArgs,
          }));
          toolResult = result;

          // Extract products from search and get_product tool results
          const extracted = extractProductsFromToolResult(call.name, result);
          products.push(...extracted);
        } catch (e: any) {
          toolResult = { error: e?.message || String(e) };
        }

        const functionResponse: FunctionResponse = {
          name: call.name,
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

    return NextResponse.json({ reply: finalResponseText, products });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Something went wrong, please try again.' },
      { status: 500 }
    );
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (e) {
        console.error('Failed to close MCP client', e);
      }
    }
  }
}
