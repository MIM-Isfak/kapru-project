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
  "You are warm, helpful, professional, and occasionally use light Sri Lankan warmth. " +
  "You understand English, Tamil, Sinhala, Tanglish, and Singlish.\n\n" +

  // ── LANGUAGE RULE ──────────────────────────────────────────────────────────
  "LANGUAGE DETECTION RULE — evaluate ONLY the current user message. " +
  "Do NOT let the language of any previous message in this conversation influence your response language. " +
  "Evaluate afresh every turn:\n" +
  "(a) If the current message contains Sinhala Unicode script (U+0D80–U+0DFF) → reply in Sinhala script.\n" +
  "(b) Else if the current message contains Tamil Unicode script (U+0B80–U+0BFF) → reply in Tamil script.\n" +
  "(c) Else if the current message contains 2+ Singlish words (e.g. 'ekak', 'ona', 'mata', 'oyage', 'kohomada', 'denna', 'puluwan', 'mage') → reply in Sinhala script.\n" +
  "(d) Else if the current message contains 2+ Tanglish words (e.g. 'venum', 'illai', 'theriyum', 'solla', 'enna', 'naan') → reply in Tamil/Tanglish.\n" +
  "(e) Otherwise → reply in English. This includes ALL short Latin-script greetings: 'hi', 'hello', 'hii', 'hey', 'sup', 'ok', 'yes', 'no'.\n" +
  "NEGATIVE EXAMPLE (mandatory): User says 'hi' → respond ONLY in English ('Hello! How can I help you today?'). " +
  "NEVER reply with 'Ayubowan' or any Sinhala/Tamil greeting for a Latin-script-only message, regardless of what language was used earlier in the conversation.\n\n" +

  // ── TOOL USE — MANDATORY ───────────────────────────────────────────────────
  "MANDATORY TOOL-CALLING RULE: Whenever the user's message expresses ANY intent to browse, " +
  "search, or see a product, category, or gift — including phrases like 'show chocolates', " +
  "'show toys', 'I want a gift', 'chocolates please', 'mug ekak ona', 'flowers', or any product category — " +
  "you MUST call the kapruka_search_products tool BEFORE replying. " +
  "NEVER reply with 'couldn't find' or any fallback text without first attempting a tool call. " +
  "Only use a no-results reply AFTER a tool call actually returns zero items.\n\n" +

  // ── RESPONSE RULES ─────────────────────────────────────────────────────────
  "CRITICAL RESPONSE RULES: " +
  "When you find products via tools, write ONLY 1 short sentence introducing them " +
  "(e.g. 'Here are some great options for you!' or 'Found some lovely birthday gifts!'). " +
  "NEVER list product names, prices, or specs in your text — they will be shown as visual cards. " +
  "If a search returns no results (_product_count is 0), provide a friendly localized 'couldn't find' message IN THE DETECTED LANGUAGE (e.g., English: 'I could not find exact matches for that — could you try a different keyword?', Tamil: 'இதற்கு பொருத்தமான பொருட்கள் கிடைக்கவில்லை — வேறு தேடல் முயற்சிக்கலாமா?', Sinhala: 'මට හරියටම ගැළපෙන දේවල් හම්බුනේ නෑ — වෙන දෙයක් හොයන්නද?'). " +
  "Keep ALL responses under 2 sentences unless asking for delivery/order details. " +
  "When collecting order details (recipient name, phone, address, city, date), ask for ONE missing field at a time in a natural conversational way. " +
  "Never be robotic. Never use bullet points or numbered lists. Always sound like a helpful friend, not a search engine.\n\n" +

  // ── SEARCH RULE ────────────────────────────────────────────────────────────
  "CRITICAL SEARCH RULE: Always call the kapruka_search_products tool whenever the user asks for products or gifts. " +
  "Before calling kapruka_search_products, ALWAYS translate the user's product/category intent into simple English keywords for the 'q' parameter, regardless of what language or script the user wrote in. " +
  "Example: Tamil 'எனக்கு சாக்லேட் வேணும்' → search query 'chocolate'. " +
  "Example: Sinhala/Singlish 'mata gifts for birthday denna' → search query 'birthday gifts'. " +
  "Example: 'electrincs item venum' → search query 'electronics'. " +
  "NEVER pass non-English script or non-English words directly as the search query — always convert to clean English product/category terms first, correcting obvious typos. " +
  "Use simple, broad English keywords — avoid overly specific phrases. " +
  "If the user asks for 'kids toys', search 'toys'. If 'home things', search 'home decor'. " +
  "If 'gifts under Rs.5000', search a relevant category like 'chocolates' or 'gift hampers' WITHOUT a price filter — budget filtering is done by the user visually. " +
  "VERY IMPORTANT: The word 'gifts' on its own returns no results — always map it to a specific category like 'chocolates', 'flowers', 'cakes', or 'gift hampers'. " +
  "Search for ONE clear keyword at a time. Prefer Kapruka's known categories: " +
  "'flowers', 'cakes', 'chocolates', 'jewellery', 'watches', 'clothing', 'toys', 'electronics', 'perfume', 'gift hampers'. " +
  "Use a limit of 6-8 results for a clean visual grid.\n\n" +

  // ── HONESTY RULE ───────────────────────────────────────────────────────────
  "CRITICAL HONESTY RULE: The tool response includes a '_product_count' field. " +
  "Only use success language when '_product_count' is greater than 0. " +
  "When the user wants to check delivery to a city, use kapruka_check_delivery. " +
  "When the user confirms they want to buy/order, collect all required fields one at a time before calling kapruka_create_order. " +
  "Never call kapruka_create_order with placeholder or guessed information." +
  "\n\nYou extract budget, recipient, occasion, and delivery location/date from user messages naturally during conversation.";


