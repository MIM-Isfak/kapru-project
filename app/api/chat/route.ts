import { NextResponse } from 'next/server';
import { geminiRotator, GEMINI_MODEL, SYSTEM_PROMPT } from '@/lib/gemini';
import { getMcpClient, getMcpToolsAsGeminiDeclarations, invalidateMcpClient, callMcpTool } from '@/lib/mcp-client';
import type { ChatMessage, Product } from '@/lib/types';
import type { Content, Part, FunctionResponse, FunctionCall } from '@google/genai';
import { determineStage } from '@/lib/agent-stages';

// Type for raw MCP callTool result
type McpToolResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

/**
 * Retries fn() on quota/rate-limit/network errors, rotating to the next Gemini API key
 * on each failure. Gives up only after every key in the pool has been tried.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const totalKeys = geminiRotator.keyCount;
  let triedCount = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const status = (error as { status?: number })?.status;
      
      // Catch rate limits (429), quota exhaustion, and temporary API outages (503, 500, fetch failed)
      const isRetryableError =
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('quota') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('fetch failed') ||
        msg.includes('timeout') ||
        status === 429 ||
        status === 503;

      if (isRetryableError) {
        triedCount++;
        const { rotated } = geminiRotator.rotateOnQuota(triedCount);
        if (!rotated) {
          // All keys exhausted
          console.error(`[Gemini] All ${totalKeys} API key(s) exhausted (or network failed). Throwing.`);
          throw error;
        }
        // Small backoff before retrying with new key
        await new Promise(resolve => setTimeout(resolve, 500));
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
  compare_at_price?: { amount?: number } | null;
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

function simplifyQuery(q: string): string | null {
  if (!q) return null;
  const original = q.toLowerCase();
  
  // Remove price constraints like "under 5000", "below rs. 5000"
  let simplified = original.replace(/(under|below|less than)\s*(rs\.?|lkr)?\s*\d+/gi, '').trim();
  
  // Remove generic trailing words and intent verbs (English, Singlish, Tanglish)
  simplified = simplified.replace(/\b(things|items|show|me|some|want|need|ekak|ona|thaanga|kudunga|denna)\b/gi, '').trim();

  // Strip gender/age prefixes
  simplified = simplified.replace(/\b(kids|mens|womens|men|women|boys|girls)\b/gi, '').trim();

  if (simplified && simplified !== original && simplified.length > 2) {
    return simplified;
  }
  
  // If it's still exactly the same, or became empty, try grabbing the longest significant word
  const words = original.split(/\s+/).filter(w => w.length > 3 && !['show', 'some', 'with'].includes(w));
  if (words.length > 0) {
    const longest = words.reduce((a, b) => a.length > b.length ? a : b);
    if (longest !== original && longest.length > 2) return longest;
  }

  return null;
}

/**
 * Build the callTool arguments, ensuring response_format: 'json' is always
 * set inside the `params` object — regardless of whether Gemini sent the args
 * with a params wrapper (Shape A) or flattened (Shape B).
 *
 *   Shape A: { params: { q: '...', ... } }   ← MCP inputSchema has params wrapper
 *   Shape B: { q: '...', ... }               ← Gemini flattened the schema
 */
function buildCallArgs(rawArgs: Record<string, unknown>, toolName: string): Record<string, unknown> {
  // Only kapruka search tools need response_format
  if (!toolName.startsWith('kapruka_')) return rawArgs;

  if (rawArgs.params && typeof rawArgs.params === 'object' && !Array.isArray(rawArgs.params)) {
    // Shape A — inject inside existing params
    return {
      ...rawArgs,
      params: {
        ...(rawArgs.params as Record<string, unknown>),
        response_format: 'json',
      },
    };
  }

  // Shape B — Gemini flattened the args; wrap them in params
  return {
    params: {
      ...rawArgs,
      response_format: 'json',
    },
  };
}

function detectSinglish(text: string): boolean {
  if (!text) return false;
  // Best-effort heuristic for Romanized Sinhala (require 2+ distinct keyword matches)
  // Words chosen to avoid overlap with English and Tanglish.
  const words = text.toLowerCase().split(/[^a-z]+/);
  const singlishKeywords = new Set([
    "ekak", "ona", "kohomada", "mata", "oyage", "hondai", "epa",
    "puluwan", "oya", "mage", "denna", "karanna", "gedara",
    "thiyenawa", "nadda", "koheda", "kiyala", "balanna"
  ]);
  let count = 0;
  for (const w of words) {
    if (singlishKeywords.has(w)) count++;
  }
  return count >= 2;
}

function detectTanglish(text: string): boolean {
  if (!text) return false;
  // Best-effort heuristic for Romanized Tamil
  const words = text.toLowerCase().split(/[^a-z]+/);
  const tanglishKeywords = new Set([
    "venum", "illai", "theriyum", "solla", "enna", "naan", "unakku",
    "sollu", "paarunga", "kudunga", "thaanga", "romba", "paathaan"
  ]);
  let count = 0;
  for (const w of words) {
    if (tanglishKeywords.has(w)) count++;
  }
  return count >= 2;
}

function getLocalizedSuccessMessage(isSinglish: boolean, isTanglish: boolean, lastUserText: string): string {
  if (/[\u0D80-\u0DFF]/.test(lastUserText) || isSinglish) {
    return 'මෙන්න ඔබට ගැළපෙන ප්‍රතිඵල කිහිපයක්!';
  }
  if (/[\u0B80-\u0BFF]/.test(lastUserText) || isTanglish) {
    return 'இதோ உங்களுக்கான சில முடிவுகள்!';
  }
  return "Here are some options that might work for you!";
}

function getLocalizedNoResultsMessage(isSinglish: boolean, isTanglish: boolean, lastUserText: string): string {
  if (/[\u0D80-\u0DFF]/.test(lastUserText) || isSinglish) {
    return "මට හරියටම ගැළපෙන දේවල් හම්බුනේ නෑ — වෙන දෙයක් හොයන්නද?";
  }
  if (/[\u0B80-\u0BFF]/.test(lastUserText) || isTanglish) {
    return "இதற்கு பொருத்தமான பொருட்கள் கிடைக்கவில்லை — வேறு தேடல் முயற்சிக்கலாமா?";
  }
  return "I couldn't find exact matches — want me to try a different search?";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // MCP connection is best-effort — if the Kapruka server is unreachable we
    // degrade gracefully to a text-only assistant rather than throwing a 500.
    let mcpClient = null;
    let toolDeclarations: Awaited<ReturnType<typeof getMcpToolsAsGeminiDeclarations>> = [];
    try {
      mcpClient = await getMcpClient();
      toolDeclarations = await getMcpToolsAsGeminiDeclarations(mcpClient);
    } catch (mcpErr: unknown) {
      console.warn('[Chat API] MCP connection failed — running without tools:', mcpErr instanceof Error ? mcpErr.message : String(mcpErr));
      invalidateMcpClient();
    }

    let contents: Content[] = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Gemini requires the history to start with a 'user' message and strictly alternate.
    // 1. Remove leading 'model' messages
    while (contents.length > 0 && contents[0].role === 'model') {
      contents.shift();
    }
    
    // 2. Collapse consecutive messages of the same role
    const collapsedContents: Content[] = [];
    for (const msg of contents) {
      if (collapsedContents.length > 0 && collapsedContents[collapsedContents.length - 1].role === msg.role) {
        const lastMsg = collapsedContents[collapsedContents.length - 1];
        if (lastMsg.parts && lastMsg.parts.length > 0) {
          lastMsg.parts[0].text = (lastMsg.parts[0].text ?? '') + '\n\n' + (msg.parts?.[0]?.text ?? '');
        }
      } else {
        collapsedContents.push(msg);
      }
    }
    contents = collapsedContents;

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const lastUserText = lastUserMessage?.content || '';
    const isSinglish = detectSinglish(lastUserText);
    const isTanglish = !isSinglish && detectTanglish(lastUserText);
    let dynamicSystemPrompt = SYSTEM_PROMPT;
    if (isSinglish) {
      dynamicSystemPrompt += "\n\nCRITICAL HEURISTIC OVERRIDE: The user's last message contains Singlish (Romanized Sinhala) words. You MUST reply in native Sinhala Unicode script.";
    } else if (isTanglish) {
      dynamicSystemPrompt += "\n\nCRITICAL HEURISTIC OVERRIDE: The user's last message contains Tanglish (Romanized Tamil) words. You MUST reply in Tamil script or Tanglish.";
    }

    let finalResponseText = '';
    const products: Product[] = [];
    const allFunctionCalls: FunctionCall[] = [];

    // 25-second overall timeout — if nothing resolves, bail with a friendly error
    const timeoutMs = 25000;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
    });

    try { await Promise.race([runConversationLoop(), timeoutPromise]); }
    catch (loopErr: unknown) {
      const msg = (loopErr instanceof Error ? loopErr.message : String(loopErr));
      if (msg === 'REQUEST_TIMEOUT') {
        console.warn('[Chat API] Request timed out after 25s — returning friendly error.');
        const errMsg = /[\u0D80-\u0DFF]/.test(lastUserText)
          ? 'ඕයෝ, Kapru ට ඒ ගාන ප්‍රතිචාරය ලැබීමට ටිකක් කාලය ගතවුණා — නැවත try කරන්නකෝ?'
          : /[\u0B80-\u0BFF]/.test(lastUserText)
          ? 'அய்யோ, Kapru-க்கு சற்று தாமதமாகிவிட்டது — மீண்டும் முயற்சிக்கவும்.'
          : "Hmm, Kapru took a bit too long there — mind trying again?";
        return NextResponse.json({ reply: errMsg, products: [], stage: 'discovery' });
      }
      throw loopErr;
    } finally {
      clearTimeout(timeoutHandle!);
    }

    // ── Safety net: if Gemini replied with a no-result phrase but called no tool,
    //    or returned completely empty text without calling a tool,
    //    force-call kapruka_search_products with the raw user message as the query.
    //    This handles the rare case where the model ignores the mandatory tool rule.
    if (allFunctionCalls.length === 0 && mcpClient) {
      const lower = (finalResponseText || "").toLowerCase();
      const noResultPhrases = ["couldn't find", "could not find", "no results", "not available", "try a different"];
      const seemsNoResult = !finalResponseText || noResultPhrases.some(p => lower.includes(p));
      const seemsSearchIntent = [
        "show", "want", "need", "looking", "search", "find", "get me", "give me", "send",
        "ekak", "ona", "thaanga", "kudunga", "venum", "illai"
      ].some(kw => lastUserText.toLowerCase().includes(kw));

      // Also trigger if the query is just a single/double noun phrase like "chocolates"
      const isShortQuery = lastUserText.split(' ').length <= 3 && lastUserText.length > 2;

      if (seemsNoResult && (seemsSearchIntent || isShortQuery)) {
        console.warn('[Chat API] SAFETY NET: Gemini returned no-result or empty text without calling the tool. Force-calling kapruka_search_products.');
        try {
          let safetyQuery = simplifyQuery(lastUserText) || lastUserText.split(' ').slice(0, 2).join(' ');
          
          if (/[^\x00-\x7F]/.test(safetyQuery) || isSinglish || isTanglish) {
            console.warn(`[Chat API] SAFETY NET: Query "${safetyQuery}" is non-English. Translating...`);
            try {
              const translationRes = await withRetry(async () => {
                return await geminiRotator.current().models.generateContent({
                  model: GEMINI_MODEL,
                  contents: [{ role: 'user', parts: [{ text: `Translate the following shopping intent to a single simple English keyword (e.g. 'chocolate', 'electronics', 'gift'). Reply ONLY with the keyword. Text: "${safetyQuery}"` }] }],
                  config: { temperature: 0.1, maxOutputTokens: 10 }
                });
              });
              let keyword = translationRes.text?.trim().replace(/['"]/g, '');
              console.log(`[Chat API] SAFETY NET RAW TRANSLATION: "${keyword}"`);
              if (keyword && !/[^\x00-\x7F]/.test(keyword) && keyword.length < 50) {
                console.log(`[Chat API] SAFETY NET: Translated "${safetyQuery}" -> "${keyword}"`);
                safetyQuery = keyword;
              } else {
                console.warn(`[Chat API] SAFETY NET WARNING: Translation failed or returned non-English keyword. Proceeding with raw query.`);
              }
            } catch(e) {
              console.error(`[Chat API] SAFETY NET: Translation request failed. Proceeding with raw query.`, e);
            }
          }
          
          const safetyArgs = { params: { q: safetyQuery, limit: 8, response_format: 'json' } };
          const safetyResult = await callMcpTool('kapruka_search_products', safetyArgs) as McpToolResult;
          const safetyProducts = extractProductsFromToolResult('kapruka_search_products', safetyResult);
          if (safetyProducts.length > 0) {
            products.push(...safetyProducts);
            finalResponseText = getLocalizedSuccessMessage(isSinglish, isTanglish, lastUserText);
          }
        } catch (safetyErr) {
          console.warn('[Chat API] Safety net tool call also failed:', safetyErr instanceof Error ? safetyErr.message : String(safetyErr));
        }
      }
    }

    async function runConversationLoop() {
    let iterations = 0;
    while (iterations < 5) {
      iterations++;

      const config: Record<string, unknown> = {
        systemInstruction: dynamicSystemPrompt,
        temperature: 0.45,
      };

      if (toolDeclarations.length > 0) {
        config.tools = [{ functionDeclarations: toolDeclarations }];
      }

      const response = await withRetry(() => geminiRotator.current().models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config
      }));

      // ── Diagnostic logging ──────────────────────────────────────────────────
      const _candidate = response.candidates?.[0];
      const _parts = _candidate?.content?.parts;
      console.log('[Chat API] GEMINI RESPONSE DIAGNOSTICS', {
        activeKeyIndex: geminiRotator.keyCount > 0 ? '(see rotator)' : 'unknown',
        finishReason: _candidate?.finishReason ?? 'NO_CANDIDATE',
        contentRole: _candidate?.content?.role ?? 'none',
        partsExists: Array.isArray(_parts),
        partsLength: Array.isArray(_parts) ? _parts.length : 'N/A',
        partTypes: Array.isArray(_parts) ? _parts.map(p => Object.keys(p).join('|')) : [],
        safetyRatings: _candidate?.safetyRatings?.map(r => `${r.category}:${r.probability}`) ?? [],
        hasFunctionCalls: Array.isArray(response.functionCalls) && response.functionCalls.length > 0,
        textLength: typeof response.text === 'string' ? response.text.length : 'N/A',
      });
      // ────────────────────────────────────────────────────────────────────────

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

        const rawArgs = (call.args ?? {}) as Record<string, unknown>;
        const callArgs = buildCallArgs(rawArgs, toolName);

        let toolResult: McpToolResult | { error: string };
        let extractedCount = 0;
        try {
          console.log(`[Chat API] Invoking tool: ${toolName}`, JSON.stringify(callArgs));
          let result = await callMcpTool(toolName, callArgs) as McpToolResult;
          toolResult = result;

          let extracted = extractProductsFromToolResult(toolName, result);

          // BUG 3 FIX: Retry logic for 0 results on kapruka_search_products
          if (toolName === 'kapruka_search_products' && extracted.length === 0) {
            // Fix: the parameter name is 'q', not 'query'
            const q = (callArgs as any)?.params?.q;
            console.warn(`[Chat API] SEARCH FAILED for "${q}". Raw MCP Response:`, JSON.stringify(result).slice(0, 500));
            
            const simpler = typeof q === 'string' ? simplifyQuery(q) : null;
            if (simpler) {
              console.log(`[Chat API] Retrying search with simplified query: "${simpler}"`);
              const fallbackArgs = { ...callArgs, params: { ...(callArgs as any).params, q: simpler } };
              result = await callMcpTool(toolName, fallbackArgs) as McpToolResult;
              toolResult = result;
              extracted = extractProductsFromToolResult(toolName, result);
            }
          }

          extractedCount = extracted.length;
          products.push(...extracted);

          if (toolName === 'kapruka_search_products' || toolName === 'kapruka_get_product') {
            console.log(`[Chat API] ${toolName} → ${extractedCount} product(s) extracted.`);
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error(`[Chat API] Tool ${toolName} failed:`, errMsg);
          // Invalidate so next request gets a fresh MCP connection
          if (errMsg.includes('ECONNRESET') || errMsg.includes('fetch failed') || errMsg.includes('unavailable')) {
            invalidateMcpClient();
            mcpClient = null;
          }
          toolResult = { error: errMsg };
        }

        // Inject _product_count into the function response so the model knows
        // how many results were actually returned — this prevents it from
        // claiming "I found results" when the search returned zero items.
        const enrichedResult: Record<string, unknown> =
          'error' in (toolResult as object)
            ? { ...(toolResult as Record<string, unknown>) }
            : {
                ...(toolResult as Record<string, unknown>),
                _product_count: extractedCount,
                _note:
                  extractedCount === 0
                    ? 'Search returned ZERO products. Do NOT tell the user you found results.'
                    : `Search returned ${extractedCount} product(s). You may present them to the user.`,
              };

        const functionResponse: FunctionResponse = {
          name: toolName,
          response: enrichedResult,
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
    } // end runConversationLoop

    // ── Fallback: if the loop exhausted iterations without producing text, force
    //    one final generation without tools so the model must produce a summary.
    if (!finalResponseText && allFunctionCalls.length > 0) {
      console.log('[Chat API] Loop ended without text reply — forcing summary turn.');
      const summaryResponse = await withRetry(() => geminiRotator.current().models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: { systemInstruction: SYSTEM_PROMPT },
      }));
      finalResponseText = summaryResponse.text || '';
    }

    // Absolute last resort: never return an empty string to the client.
    if (!finalResponseText) {
      finalResponseText = products.length > 0
        ? getLocalizedSuccessMessage(isSinglish, isTanglish, lastUserText)
        : getLocalizedNoResultsMessage(isSinglish, isTanglish, lastUserText);
    }

    // Log final state before responding
    console.log(`[Chat API] Final: products=${products.length}, textLength=${finalResponseText.length}`);

    // ── Honesty guard: if no products were found, ensure the reply doesn't
    //    falsely claim success.
    if (products.length === 0 && finalResponseText) {
      const lower = finalResponseText.toLowerCase();
      const falseSuccessPhrases = [
        'i found',
        'here are',
        'take a look',
        "i've found",
        'found some',
        'found a few',
        'found the following',
        'results for you',
        "here's what i found",
        'check out these',
        'i searched and found',
        'මෙන්න', // Sinhala "here"
        'இதோ'   // Tamil "here"
      ];
      const isFalseSuccess = falseSuccessPhrases.some(p => lower.includes(p));
      if (isFalseSuccess) {
        console.warn('[Chat API] Honesty guard triggered — overriding false success reply.');
        finalResponseText = getLocalizedNoResultsMessage(isSinglish, isTanglish, lastUserText);
      }
    }

    const stage = determineStage(allFunctionCalls, finalResponseText, messages);
    return NextResponse.json({ reply: finalResponseText, products, stage });

  } catch (error: unknown) {
    console.error('Chat API FULL error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    const errObj = error as { status?: number; response?: { status?: number }, cause?: { message?: string, code?: string } };
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    const causeMsg = (errObj?.cause?.message || '').toLowerCase();
    const causeCode = (errObj?.cause?.code || '').toLowerCase();
    const status = errObj?.status || errObj?.response?.status;

    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted') || status === 429) {
      return NextResponse.json(
        { error: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    if (
      msg.includes('fetch failed') || 
      msg.includes('timeout') || 
      causeMsg.includes('connecttimeout') || 
      causeMsg.includes('timeout') || 
      causeCode.includes('etimedout') || 
      causeCode.includes('econnreset')
    ) {
      return NextResponse.json(
        { error: "NETWORK_ERROR" },
        { status: 503 }
      );
    }

    if (msg.includes('401') || msg.includes('403') || msg.includes('key') || msg.includes('auth') || status === 401 || status === 403) {
      console.error('API KEY INVALID OR MISSING');
      return NextResponse.json(
        { error: "UNKNOWN" }, // Config issues can be treated as generic unknown for the user
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'UNKNOWN' },
      { status: 500 }
    );
  }
}
