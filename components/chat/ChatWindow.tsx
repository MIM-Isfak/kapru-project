"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ProductCard } from "@/components/products/ProductCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { ChatMessage, Product } from "@/lib/types";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, products]);

  const handleSend = async (text: string) => {
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setProducts([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();
      
      const newAssistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.reply || "",
        timestamp: Date.now(),
        stage: data.stage,
      };

      setMessages((prev) => [...prev, newAssistantMessage]);
      setProducts(data.products || []);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, something went wrong — please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const lastAssistantMessageId = messages.slice().reverse().find(m => m.role === "assistant")?.id;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3 pb-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              <MessageBubble message={msg} />
              
              {msg.id === lastAssistantMessageId && products.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 ml-2 sm:ml-10">
                  {products.map((product) => (
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
          ))}

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
