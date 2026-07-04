"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ProductCard } from "@/components/products/ProductCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, ChevronDown } from "lucide-react";
import { ChatMessage } from "@/lib/types";
import { useCart } from "@/lib/cart-context";

// ── Kapru-voiced terminal error messages ──────────────────────────────────────
// Used only when the API call fails completely (no successful retry follows).
const KAPRU_ERROR_MESSAGES = {
  generic: {
    en: "Hmm, Kapru hit a snag there — mind trying that again?",
    si: "ඕයෝ, Kapru ට ඒ ගාන අස්සේ ගැටලුවක් ආවා — ටිකක් wait කරලා try කරන්නකෝ?",
    ta: "அய்யோ, Kapru-க்கு சிறு சிக்கல் ஏற்பட்டது — மீண்டும் முயற்சிக்கவும்?",
  },
  rate_limit: {
    en: "I'm getting a lot of requests right now — please wait a few seconds and try again.",
    si: "දැන් මට requests ගොඩක් එනවා — කරුණාකර තත්පර කිහිපයක් රැඳී සිට නැවත උත්සාහ කරන්න.",
    ta: "தற்போது எனக்கு நிறைய கோரிக்கைகள் வருகின்றன — தயவுசெய்து சில நொடிகள் காத்திருந்து மீண்டும் முயற்சிக்கவும்."
  },
  network: {
    en: "It looks like my connection dropped — could you check your internet and try again?",
    si: "මගේ connection එක නැති වුණා වගේ — කරුණාකර ඔබගේ internet එක පරීක්ෂා කර නැවත උත්සාහ කරන්නද?",
    ta: "என்னுடைய இணைப்பு துண்டிக்கப்பட்டதாகத் தெரிகிறது — உங்கள் இணையத்தை சரிபார்த்து மீண்டும் முயற்சிக்க முடியுமா?"
  }
};

function getKapruErrorMessage(type: 'generic' | 'rate_limit' | 'network', lastUserContent: string): string {
  const messages = KAPRU_ERROR_MESSAGES[type] || KAPRU_ERROR_MESSAGES.generic;
  // Detect Sinhala script (U+0D80–U+0DFF)
  if (/[\u0D80-\u0DFF]/.test(lastUserContent)) return messages.si;
  // Detect Tamil script (U+0B80–U+0BFF)
  if (/[\u0B80-\u0BFF]/.test(lastUserContent)) return messages.ta;
  return messages.en;
}

export function ChatWindow() {
  const { addToCart } = useCart();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      // BUG 1 FIX: Default welcome is English — language cannot be detected
      // before the user has typed anything.
      content: "Hi! I'm Kapru, your AI shopping friend. What are you shopping for today?",
      timestamp: 1700000000000,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // Guard against rapid double-submissions (double-click, Enter spam)
  const pendingRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // ── Scroll-to-bottom tracking ─────────────────────────────────────────────
  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distFromBottom < 150;
    isNearBottomRef.current = near;
    setShowScrollBtn(!near);
  }, []);

  // Auto-scroll only when already near bottom
  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ── Send handler ─────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    // Guard: prevent duplicate submissions
    if (pendingRef.current || isLoading) return;
    // Guard: ignore empty/whitespace messages
    const trimmed = text.trim();
    if (!trimmed) return;
    // Guard: truncate extremely long messages (>600 chars) gracefully
    const safeText = trimmed.length > 600 ? trimmed.slice(0, 600) + '…' : trimmed;

    pendingRef.current = true;
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: safeText,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setIsLoading(true);
    // When user sends, snap to bottom
    isNearBottomRef.current = true;
    setShowScrollBtn(false);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errType = (data?.error || "UNKNOWN").toLowerCase();
        const typeKey = errType === "rate_limit" 
          ? "rate_limit" 
          : errType === "network_error" 
            ? "network" 
            : "generic";
        
        throw new Error(getKapruErrorMessage(typeKey, safeText));
      }

      const replyText: string =
        data.reply && data.reply.trim().length > 0
          ? data.reply
          : "Here are some results for you!";

      const newAssistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: replyText,
        timestamp: Date.now(),
        stage: data.stage,
        products: Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : undefined,
      };

      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch (err: unknown) {
      // BUG 4 FIX: use Kapru-voiced error, keyed to the user's language
      let message = err instanceof Error ? err.message : getKapruErrorMessage('generic', safeText);
      
      // If fetch fails locally before reaching the server, convert to network error
      if (message.includes("Failed to fetch") || message.includes("Load failed")) {
        message = getKapruErrorMessage('network', safeText);
      }
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      pendingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Scroll area with onScroll listener */}
      <ScrollArea
        className="flex-1 min-h-0 p-4"
        // ScrollArea renders a viewport div — we attach the ref via onScroll on the wrapper
      >
        <div
          ref={scrollContainerRef}
          className="flex flex-col gap-3 pb-4"
          onScroll={checkNearBottom}
        >
          {messages.map((msg, index) => {
            // Hide error assistant messages that were superseded by a successful retry:
            // if this message looks like a failure AND the next message is also assistant, skip it.
            const isErrorMessage =
              msg.role === "assistant" &&
              (msg.content.toLowerCase().includes("couldn't find") ||
                msg.content.toLowerCase().includes("could not find") ||
                msg.content.toLowerCase().includes("something went wrong") ||
                msg.content.toLowerCase().includes("hit a snag") ||
                msg.content.toLowerCase().includes("ගැටලුවක්") ||
                msg.content.toLowerCase().includes("சிக்கல்"));
            const nextMsg = messages[index + 1];
            const isSupersededByRetry = isErrorMessage && nextMsg?.role === "assistant";

            if (isSupersededByRetry) return null;

            return (
              <div key={msg.id} className="flex flex-col">
                <MessageBubble message={msg} />

                {/* Each assistant message permanently owns its product results */}
                {msg.role === "assistant" && msg.products && msg.products.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 ml-2 sm:ml-10">
                    {msg.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        originalPrice={product.originalPrice}
                        onAddToCart={(p) => addToCart(p)}
                        onCompare={(p) => console.log("compare", p.name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2 w-full max-w-[75%] mt-1">
              <div className="flex-shrink-0 size-8 rounded-full bg-[var(--kapru-gold)] text-white flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div className="bg-white border border-[var(--kapru-teal-light)] text-[var(--kapru-ink)] rounded-2xl px-4 py-4 flex gap-1 items-center h-12">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* ── Floating scroll-to-bottom button ────────────────────────────────── */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute bottom-[72px] right-4 z-20 flex items-center justify-center rounded-full shadow-md transition-colors duration-200"
          style={{
            width: 42,
            height: 42,
            backgroundColor: "var(--kapru-teal)",
            color: "var(--kapru-cream)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--kapru-gold)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--kapru-teal)";
          }}
        >
          <ChevronDown size={22} />
        </button>
      )}

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
