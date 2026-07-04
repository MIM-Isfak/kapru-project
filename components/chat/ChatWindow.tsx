"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ProductCard } from "@/components/products/ProductCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { ChatMessage } from "@/lib/types";
import { useCart } from "@/lib/cart-context";

export function ChatWindow() {
  const { addToCart } = useCart();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ayubowan! I'm Kapru, your AI shopping friend. What are you shopping for today?",
      timestamp: 1700000000000,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errText =
          data?.error ||
          (response.status === 429
            ? "I'm getting a lot of requests right now \u2014 please wait a moment and try again."
            : "Something went wrong. Please try again.");
        throw new Error(errText);
      }

      // Never add an empty assistant bubble — backend now guarantees a non-empty
      // reply, but guard here too just in case.
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
        // Permanently embed products inside this message object
        products: Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : undefined,
      };

      setMessages((prev) => [...prev, newAssistantMessage]);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Sorry, something went wrong \u2014 please try again.";
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="flex flex-col gap-3 pb-4">
          {messages.map((msg, index) => {
            // Hide error assistant messages that were superseded by a successful retry:
            // if this message looks like a failure AND the next message is also assistant, skip it.
            const isErrorMessage =
              msg.role === "assistant" &&
              (msg.content.toLowerCase().includes("couldn't find") ||
                msg.content.toLowerCase().includes("could not find") ||
                msg.content.toLowerCase().includes("something went wrong"));
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
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
