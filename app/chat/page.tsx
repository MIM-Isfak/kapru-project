"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCart } from "@/lib/cart-context";

export default function ChatPage() {
  const [cartOpen, setCartOpen] = useState(false);
  const { totalItems } = useCart();

  return (
    <main className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-[var(--kapru-teal-light)] px-4 py-3 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-[var(--kapru-teal)]">Kapru</h1>
          <p className="text-xs text-gray-500">Sri Lanka&apos;s AI Shopping Friend</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative p-2 text-gray-600 hover:text-[var(--kapru-teal)] transition-colors"
          aria-label="Open cart"
        >
          <ShoppingCart size={22} />
          {totalItems > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-5 rounded-full bg-[var(--kapru-coral)] text-white text-[10px] font-bold flex items-center justify-center">
              {totalItems > 99 ? "99+" : totalItems}
            </span>
          )}
        </button>
      </header>

      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </main>
  );
}
