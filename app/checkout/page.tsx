"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart } from "@/lib/cart-context";

interface OrderSuccess {
  checkout_url: string;
  order_ref: string;
  summary: {
    items_total: number;
    delivery_fee: number;
    addons_total: number;
    grand_total: number;
    currency: string;
  };
}

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();

  // Form fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [locationType, setLocationType] = useState("house");
  const [instructions, setInstructions] = useState("");
  const [senderName, setSenderName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Autocomplete state
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [isCityFocused, setIsCityFocused] = useState(false);
  const cityDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<OrderSuccess | null>(null);

  // Today's date in YYYY-MM-DD for the date input min (Asia/Colombo timezone)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());

  if (items.length === 0 && !success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center gap-4">
        <p className="text-gray-500 text-lg">Your cart is empty.</p>
        <Link
          href="/chat"
          className="px-5 py-2 rounded-xl bg-[var(--kapru-teal)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Back to Shopping
        </Link>
      </div>
    );
  }

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCity(val);
    
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    
    if (val.trim().length >= 2) {
      cityDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/cities?q=${encodeURIComponent(val.trim())}`);
          const data = await res.json() as { cities: { name: string }[] };
          setCitySuggestions(data.cities.map((c) => c.name));
        } catch {
          setCitySuggestions([]);
        }
      }, 300);
    } else {
      setCitySuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate required fields
    if (!recipientName.trim() || !recipientPhone.trim() || !address.trim() || !city.trim() || !date || !senderName.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: items.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity,
          })),
          recipient: {
            name: recipientName.trim(),
            phone: recipientPhone.trim(),
          },
          delivery: {
            address: address.trim(),
            city: city.trim(),
            date,
            location_type: locationType,
            instructions: instructions.trim() || null,
          },
          sender: {
            name: senderName.trim(),
            anonymous,
          },
          gift_message: giftMessage.trim() || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        clearCart();
        setSuccess(data as OrderSuccess);
      } else {
        setErrorMsg(data.error ?? "Order could not be placed. Please try again.");
      }
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col items-center gap-6 text-center">
        <CheckCircle2 size={56} className="text-green-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Order Created!</h1>
          <p className="text-gray-500 mt-1">Ref: <span className="font-mono font-semibold">{success.order_ref}</span></p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 w-full text-left">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Items total</span>
            <span>Rs. {success.summary.items_total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>Delivery fee</span>
            <span>Rs. {success.summary.delivery_fee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base text-gray-800 mt-3 pt-3 border-t border-gray-200">
            <span>Grand total</span>
            <span className="text-[var(--kapru-gold)]">Rs. {success.summary.grand_total.toLocaleString()}</span>
          </div>
        </div>
        <a
          href={success.checkout_url}
          className="w-full max-w-xs py-3 rounded-xl bg-[var(--kapru-coral)] text-white font-bold text-base text-center hover:opacity-90 transition-opacity"
        >
          Pay Now →
        </a>
        <p className="text-xs text-gray-400">You will be taken to Kapruka&apos;s secure payment page.</p>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/chat" className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--kapru-teal)] hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Checkout</h1>
      </div>

      {/* Order summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Order Summary</h2>
        <ul className="space-y-2">
          {items.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between text-sm text-gray-600">
              <span className="line-clamp-1 flex-1 pr-2">{product.name} × {quantity}</span>
              <span className="font-medium text-gray-800 flex-shrink-0">Rs. {(product.price * quantity).toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold text-base text-gray-800 mt-3 pt-3 border-t border-gray-200">
          <span>Total</span>
          <span className="text-[var(--kapru-gold)]">Rs. {totalPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recipient Details</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recipient Name *</label>
              <Input
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="Full name"
                required
                disabled={submitting}
                className="rounded-lg h-10"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recipient Phone *</label>
              <Input
                value={recipientPhone}
                onChange={e => setRecipientPhone(e.target.value)}
                placeholder="077XXXXXXX"
                required
                disabled={submitting}
                className="rounded-lg h-10"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Delivery Details</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Address *</label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Street address"
                required
                disabled={submitting}
                className="rounded-lg h-10"
              />
            </div>
            <div className="relative">
              <label className="block text-xs text-gray-500 mb-1">Delivery City *</label>
              <Input
                value={city}
                onChange={handleCityChange}
                onFocus={() => setIsCityFocused(true)}
                onBlur={() => setTimeout(() => setIsCityFocused(false), 200)}
                placeholder="e.g. Colombo 03"
                required
                disabled={submitting}
                className="rounded-lg h-10"
              />
              {isCityFocused && citySuggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {citySuggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      onClick={() => {
                        setCity(suggestion);
                        setCitySuggestions([]);
                      }}
                      className="px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-[var(--kapru-teal-light)] hover:text-[var(--kapru-ink)]"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-400 mt-1">Select from suggestions to ensure accurate delivery</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Date *</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={e => setDate(e.target.value)}
                required
                disabled={submitting}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Location Type</label>
              <select
                value={locationType}
                onChange={e => setLocationType(e.target.value)}
                disabled={submitting}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Instructions (optional)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Any special delivery notes..."
                disabled={submitting}
                rows={2}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 resize-none"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Sender Details</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sender Name *</label>
              <Input
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                placeholder="Your name"
                required
                disabled={submitting}
                className="rounded-lg h-10"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={e => setAnonymous(e.target.checked)}
                disabled={submitting}
                className="rounded border-input w-4 h-4 accent-[var(--kapru-teal)]"
              />
              <span className="text-sm text-gray-600">Send anonymously</span>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Gift Message (optional)</h2>
          <textarea
            value={giftMessage}
            onChange={e => setGiftMessage(e.target.value)}
            placeholder="Write a personal message for the recipient..."
            disabled={submitting}
            rows={3}
            maxLength={300}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{giftMessage.length}/300</p>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-[var(--kapru-coral)] text-white font-bold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Placing order...
            </>
          ) : (
            "Place Order"
          )}
        </button>
      </form>
    </div>
  );
}
