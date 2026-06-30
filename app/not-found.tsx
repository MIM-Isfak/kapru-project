import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--kapru-cream)] p-4 text-center font-sans">
      <div className="size-20 rounded-full bg-white border border-[var(--kapru-teal-light)] shadow-sm flex items-center justify-center mb-6 text-[var(--kapru-teal)]">
        <Compass size={40} />
      </div>
      
      <h1 className="text-4xl font-bold text-[var(--kapru-ink)] mb-3 tracking-tight">
        Page not found
      </h1>
      
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Looks like you wandered off the map. Let&apos;s get you back to shopping.
      </p>

      <Link
        href="/"
        className="bg-[var(--kapru-coral)] text-white font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-opacity"
      >
        Return Home
      </Link>
    </div>
  );
}
