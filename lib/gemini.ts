import { GoogleGenAI } from "@google/genai";

// ─── Multi-key rotator ─────────────────────────────────────────────────────────
//
// Reads GEMINI_API_KEY_1 … GEMINI_API_KEY_3 from env (falls back to the legacy
// GEMINI_API_KEY so existing single-key setups continue to work without changes).
//
// Usage in route.ts:
//   const client = geminiRotator.current();          // get active GoogleGenAI
//   geminiRotator.rotateOnQuota();                   // advance to next key
//   geminiRotator.resetForRequest();                 // reset per-request attempt tracking

function buildKeyPool(): string[] {
  const numbered = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((k): k is string => Boolean(k && k.trim().length > 0));

  if (numbered.length > 0) return numbered;

  // Legacy fallback: single GEMINI_API_KEY
  const legacy = process.env.GEMINI_API_KEY;
  if (legacy && legacy.trim().length > 0) return [legacy];

  // No keys at all — return a placeholder so we get a clear error at call time
  return [''];
}

class GeminiKeyRotator {
  private readonly keys: string[];
  /** Module-level active index — persists across requests on the same Node process */
  private activeIndex: number = 0;
  /** Clients are lazily created and cached per key */
  private readonly clients: Map<number, GoogleGenAI> = new Map();

  constructor() {
    this.keys = buildKeyPool();
  }

  get keyCount(): number {
    return this.keys.length;
  }

  /** Returns the GoogleGenAI client for the currently active key. */
  current(): GoogleGenAI {
    if (!this.clients.has(this.activeIndex)) {
      this.clients.set(
        this.activeIndex,
        new GoogleGenAI({ apiKey: this.keys[this.activeIndex] }),
      );
    }
    return this.clients.get(this.activeIndex)!;
  }

  /**
   * Advances to the next key in the pool (wrapping around).
   * Returns the new index, or -1 if we've wrapped back to the start
   * (i.e. all keys have been tried in this rotation cycle).
   */
  rotateOnQuota(triedCount: number): { rotated: boolean; newIndex: number } {
    const next = (this.activeIndex + 1) % this.keys.length;
    if (triedCount >= this.keys.length) {
      // All keys exhausted
      return { rotated: false, newIndex: this.activeIndex };
    }
    this.activeIndex = next;
    console.log(
      `[Gemini] Rotated to backup API key ${this.activeIndex + 1} of ${this.keys.length} due to quota exhaustion.`,
    );
    return { rotated: true, newIndex: this.activeIndex };
  }
}

// Singleton — shared across all requests in the same server process
export const geminiRotator = new GeminiKeyRotator();

// Keep backward-compat export so any other file importing `ai` still works
export const ai = {
  get models() {
    return geminiRotator.current().models;
  },
};

export const GEMINI_MODEL = "gemini-2.5-flash";

export const SYSTEM_PROMPT =
  "You are Kapru, a friendly Sri Lankan AI shopping assistant for Kapruka. " +
  "You are warm, helpful, professional, and occasionally use light Sri Lankan warmth " +
  "(like 'Ayubowan' as a greeting only — don't overuse it). " +
  "You understand English, Tamil, Sinhala, Tanglish, and Singlish. " +
  "CRITICAL LANGUAGE RULE: You must proactively detect Sinhala script (Unicode) OR Sinhala-in-English (Singlish) in the user's VERY FIRST message. If detected, you MUST respond in Sinhala from that message onward. Otherwise, respond in English by default unless the user continues in another language (Tamil/Tanglish), in which case match their language. " +
  "Example Sinhala responses for common intents: " +
  "1. Greeting: 'ආයුබෝවන්! මම Kapru, Kapruka හි ඔබේ AI සහායකයා. අද ඔබට අවශ්‍ය කුමක්ද?' (Ayubowan! I'm Kapru, your AI assistant at Kapruka. What do you need today?) " +
  "2. Gift recommendation: 'ඔබට අවශ්‍ය මොන වගේ තෑග්ගක්ද? උපන්දින තෑග්ගක්ද?' (What kind of gift do you need? A birthday gift?) " +
  "3. Delivery check: 'ඔව්, අපිට ඒ නගරයට ඩිලිවර් කරන්න පුළුවන්.' (Yes, we can deliver to that city.) " +
  "CRITICAL SEARCH RULE: Always call the kapruka_search_products tool whenever the user asks for products or gifts, regardless of the language they use. When making tool calls (especially kapruka_search_products), ALWAYS translate the search term into ENGLISH before calling the tool, because the product catalog is in English. Never use Sinhala, Singlish, or Tamil words in tool arguments. " +
  "You extract budget, recipient, occasion, and delivery location/date from user messages naturally during conversation. " +
  "When you find relevant products via tools, briefly introduce them in 1-2 sentences only — " +
  "do NOT list prices or specs in your text reply, since they will be shown as visual product cards separately. " +
  "Keep responses concise, conversational, and never robotic. " +
  "When searching products, use a limit of 6-8 results for a clean visual grid. " +
  "When the user wants to check delivery to a city, use kapruka_check_delivery. " +
  "When the user confirms they want to buy/order something, you MUST first collect: recipient name, recipient phone number, delivery address, delivery city, and delivery date — " +
  "ask for any that are missing, one at a time, in a natural conversational way, before calling kapruka_create_order. " +
  "Never call kapruka_create_order with placeholder or guessed information.";
