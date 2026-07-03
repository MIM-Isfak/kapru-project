"use client";

import Link from "next/link";
import {
  Sparkles,
  MessageCircle,
  Languages,
  LayoutGrid,
  Truck,
  Gift,
  ShieldCheck,
} from "lucide-react";

export default function LandingPage() {
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* 1. NAVBAR */}
      <header className="sticky top-0 z-50 bg-white border-b border-[var(--kapru-teal-light)] px-6 py-4 flex items-center justify-between">
        <div className="font-bold text-xl text-[var(--kapru-teal)]">Kapru</div>
        <Link
          href="/chat"
          className="bg-[var(--kapru-coral)] text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start Shopping
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        {/* 2. HERO SECTION */}
        <section className="min-h-[85vh] flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-[var(--kapru-cream)] to-[var(--kapru-teal-light)]/20">
          <div className="inline-flex items-center gap-1.5 bg-[var(--kapru-teal-light)] text-[var(--kapru-gold)] px-3 py-1.5 rounded-full text-xs font-medium mb-6">
            <Sparkles size={14} className="fill-current" />
            <span>AI Shopping Agent</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-[var(--kapru-ink)] max-w-4xl tracking-tight leading-tight mb-6">
            Shopping, the way it <span className="text-[var(--kapru-coral)]">should feel.</span>
          </h1>

          <p className="text-lg text-gray-600 max-w-xl mx-auto mb-10 leading-relaxed">
            Tell Kapru what you need in English, Tamil, or Sinhala — get real Kapruka
            products, smart recommendations, and a checkout that just works.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <Link
              href="/chat"
              className="bg-[var(--kapru-coral)] text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:scale-105 transition-transform"
            >
              Start Shopping &rarr;
            </Link>
            <button
              onClick={scrollToFeatures}
              className="px-8 py-3 rounded-full font-semibold text-[var(--kapru-ink)] hover:bg-gray-100 transition-colors"
            >
              See how it works
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-4 text-sm text-gray-500 flex-wrap">
            <span>🇱🇰 Built for Sri Lanka</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>Real Kapruka catalog</span>
            <span className="hidden sm:inline">&middot;</span>
            <span>English &middot; Tamil &middot; Sinhala</span>
          </div>
        </section>

        {/* 3. LANGUAGE DEMO STRIP */}
        <section className="w-full bg-[var(--kapru-teal)] text-white py-6 overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 flex flex-col items-center">
            <p className="text-xs opacity-80 mb-4 uppercase tracking-widest font-semibold">
              Kapru understands you, however you type
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="bg-white/10 rounded-full px-4 py-2 text-sm whitespace-nowrap">
                I need a birthday gift 🎂
              </span>
              <span className="bg-white/10 rounded-full px-4 py-2 text-sm whitespace-nowrap">
                Enakku 5000 budget la gift venum
              </span>
              <span className="bg-white/10 rounded-full px-4 py-2 text-sm whitespace-nowrap">
                mage amma ta gift ekak ona
              </span>
              <span className="bg-white/10 rounded-full px-4 py-2 text-sm whitespace-nowrap">
                Gaming ekata laptop ona
              </span>
            </div>
          </div>
        </section>

        {/* 4. FEATURES SECTION */}
        <section id="features" className="py-20 max-w-6xl mx-auto px-4 w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--kapru-ink)] mb-4">
              Not just a chatbot.
            </h2>
            <p className="text-lg text-gray-500">
              A complete shopping experience, powered by conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <MessageCircle className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">Talk naturally</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Describe what you need like you&apos;re texting a friend. No filters to fiddle with.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <Languages className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">Speaks your language</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                English, Tamil, Sinhala, even Tanglish and Singlish — Kapru just gets it.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <LayoutGrid className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">See, don&apos;t just read</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Products appear as rich visual cards with images, prices, and ratings — not walls of text.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <Truck className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">Delivery you can trust</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Real-time delivery checks across Sri Lanka, right inside the conversation.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <Gift className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">Built for gifting</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Birthdays, anniversaries, Mother&apos;s Day — Kapru finds the right gift for the moment.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-2xl border border-[var(--kapru-teal-light)] p-6 hover:shadow-md transition-shadow">
              <div className="size-12 rounded-full bg-[var(--kapru-teal-light)]/50 flex items-center justify-center mb-5">
                <ShieldCheck className="text-[var(--kapru-teal)]" size={24} />
              </div>
              <h3 className="text-lg font-bold text-[var(--kapru-ink)] mb-2">Real checkout, no signup</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Guest checkout straight to Kapruka&apos;s secure payment — no account needed.
              </p>
            </div>
          </div>
        </section>

        {/* 5. FINAL CTA SECTION */}
        <section className="py-24 text-center bg-[var(--kapru-cream)] px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--kapru-ink)] mb-8">
            Ready when you are.
          </h2>
          <Link
            href="/chat"
            className="inline-block bg-[var(--kapru-coral)] text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:scale-105 transition-transform"
          >
            Start Shopping &rarr;
          </Link>
        </section>
      </main>

      {/* 6. FOOTER */}
      <footer className="py-8 border-t border-gray-200 text-center text-sm text-gray-400 bg-white">
        <p>Kapru — Built for the Kapruka Agent Challenge 2026</p>
      </footer>
    </div>
  );
}
