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
  "You understand English, Tamil, Sinhala, Tanglish, and Singlish, and respond in English by default " +
  "unless the user continues in another language, in which case you match their language. " +
  "\n\nYou extract budget, recipient, occasion, and delivery location/date from user messages naturally during conversation. " +
  "\n\nCRITICAL RESPONSE RULES: " +
  "When you find products via tools, write ONLY 1 short sentence introducing them " +
  "(e.g. 'Here are some great options for you!' or 'Found some lovely birthday gifts!'). " +
  "NEVER list product names, prices, or specs in your text — they will be shown as visual cards. " +
  "If a search returns no results, say: 'I could not find exact matches for that. Could you try a different keyword or tell me more about what you need?' — keep it friendly, max 1 sentence. " +
  "Keep ALL responses under 2 sentences unless asking for delivery/order details. " +
  "When collecting order details (recipient name, phone, address, city, date), ask for ONE missing field at a time in a natural conversational way. " +
  "Never be robotic. Never use bullet points or numbered lists. Always sound like a helpful friend, not a search engine. " +
  "\n\nCRITICAL SEARCH RULE: Always call the kapruka_search_products tool whenever the user asks for products or gifts. " +
  "When making tool calls, ALWAYS translate the search term into ENGLISH because the product catalog is in English. " +
  "Search for ONE clear keyword at a time. Prefer Kapruka's known categories: " +
  "'flowers', 'cakes', 'chocolates', 'jewellery', 'watches', 'clothing', 'toys', 'electronics', 'perfume', 'gift hampers'. " +
  "Use a limit of 6-8 results for a clean visual grid. " +
  "\n\nCRITICAL HONESTY RULE: The tool response includes a '_product_count' field. " +
  "Only use success language when '_product_count' is greater than 0. " +
  "When the user wants to check delivery to a city, use kapruka_check_delivery. " +
  "When the user confirms they want to buy/order, collect all required fields one at a time before calling kapruka_create_order. " +
  "Never call kapruka_create_order with placeholder or guessed information.";
