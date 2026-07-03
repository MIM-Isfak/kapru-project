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
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
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
  /** Tracks cooldown timestamps for exhausted keys */
  private readonly cooldowns: Map<number, number> = new Map();

  constructor() {
    this.keys = buildKeyPool();
  }

  get keyCount(): number {
    return this.keys.length;
  }

  /** Returns the GoogleGenAI client for the currently active key. */
  current(): GoogleGenAI {
    // If the active key is on cooldown but no other key is available, we might still be on it.
    // However, withRetry should avoid calling this if it just threw.
    if (!this.clients.has(this.activeIndex)) {
      this.clients.set(
        this.activeIndex,
        new GoogleGenAI({ apiKey: this.keys[this.activeIndex] }),
      );
    }
    return this.clients.get(this.activeIndex)!;
  }

  /**
   * Marks the current key as exhausted for 60 seconds, then advances to the next 
   * available key in the pool (wrapping around).
   * Returns rotated: false if ALL keys are currently on cooldown.
   */
  rotateOnQuota(triedCount: number): { rotated: boolean; newIndex: number } {
    // Mark the current key on cooldown for 60 seconds
    this.cooldowns.set(this.activeIndex, Date.now() + 60000);

    // Find the next key that is not on cooldown
    for (let i = 1; i <= this.keys.length; i++) {
      const idx = (this.activeIndex + i) % this.keys.length;
      const cooldownUntil = this.cooldowns.get(idx) || 0;
      
      if (Date.now() >= cooldownUntil) {
        this.activeIndex = idx;
        console.log(
          `[Gemini] Rotated to backup API key ${this.activeIndex + 1} of ${this.keys.length} due to quota exhaustion.`,
        );
        return { rotated: true, newIndex: this.activeIndex };
      }
    }

    // All keys are currently on cooldown
    return { rotated: false, newIndex: this.activeIndex };
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
  "CRITICAL SEARCH STRATEGY: Search for ONE clear keyword at a time — never combine multiple product types in a single query (e.g. don't search 'watches and electronics'). If the user asks for multiple types, make separate searches. Prefer Kapruka's known categories: 'flowers', 'cakes', 'chocolates', 'jewellery', 'watches', 'clothing', 'toys', 'electronics', 'perfume', 'gift hampers'. " +
  "CRITICAL HONESTY RULE: The tool response always includes a '_product_count' field and a '_note' field. You MUST check '_product_count' before responding. " +
  "If '_product_count' is 0 or the '_note' says 'Search returned ZERO products', you MUST NOT say 'I found results', 'here are some options', or any similar success phrasing. " +
  "Instead, honestly tell the user something like: 'I couldn't find exact matches for that on Kapruka — want me to try a different keyword or category?' Then suggest a refined search. " +
  "Only use success language ('here are some great options', 'I found these for you', etc.) when '_product_count' is greater than 0. " +
  "You extract budget, recipient, occasion, and delivery location/date from user messages naturally during conversation. " +
  "When you find relevant products via tools, briefly introduce them in 1-2 sentences only — " +
  "do NOT list prices or specs in your text reply, since they will be shown as visual product cards separately. " +
  "Keep responses concise, conversational, and never robotic. " +
  "When searching products, use a limit of 6-8 results for a clean visual grid. " +
  "When the user wants to check delivery to a city, use kapruka_check_delivery. " +
  "When the user confirms they want to buy/order something, you MUST first collect: recipient name, recipient phone number, delivery address, delivery city, and delivery date — " +
  "ask for any that are missing, one at a time, in a natural conversational way, before calling kapruka_create_order. " +
  "Never call kapruka_create_order with placeholder or guessed information.";
