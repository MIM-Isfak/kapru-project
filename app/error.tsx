"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--kapru-cream)] p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--kapru-teal-light)] max-w-md w-full flex flex-col items-center">
        <div className="size-16 rounded-full bg-red-50 flex items-center justify-center mb-6 text-red-500">
          <AlertCircle size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-[var(--kapru-ink)] mb-2">
          Something went wrong
        </h1>
        
        <p className="text-gray-600 mb-8 leading-relaxed">
          We encountered an unexpected error. Don&apos;t worry, you can try again or head back to the chat.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => reset()}
            className="w-full bg-[var(--kapru-coral)] text-white font-semibold py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          
          <button
            onClick={() => window.location.href = "/chat"}
            className="w-full bg-white text-[var(--kapru-teal)] border border-[var(--kapru-teal-light)] font-semibold py-3 rounded-full hover:bg-gray-50 transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </div>
    </div>
  );
}
