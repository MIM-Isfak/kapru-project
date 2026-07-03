"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart-context";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const router = useRouter();
  const { items, removeFromCart, updateQuantity, totalItems, totalPrice } = useCart();

  const handleCheckout = () => {
    onOpenChange(false);
    router.push("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-[85vw] sm:w-[400px] sm:max-w-md p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-[var(--kapru-teal)] font-bold text-lg">
            Your Cart{totalItems > 0 && ` (${totalItems})`}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <ShoppingCart size={40} strokeWidth={1.5} />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 py-2">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-3 items-start">
                  <div className="relative size-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-100">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="size-full bg-gray-100" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1 text-gray-800">
                      {product.name}
                    </p>
                    <p className="text-sm text-[var(--kapru-teal)] font-semibold mt-0.5">
                      Rs. {(product.price * quantity).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="size-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm w-4 text-center">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="size-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(product.id)}
                    className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-gray-100">
            <Separator className="mb-3" />
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-bold text-[var(--kapru-gold)] text-base">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full py-3 rounded-xl bg-[var(--kapru-coral)] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Proceed to Checkout
            </button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
