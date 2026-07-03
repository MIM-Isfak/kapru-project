import { Sparkles } from "lucide-react";
import { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="ml-auto bg-[var(--kapru-teal)] text-white rounded-2xl p-4 max-w-[75%] mt-2 mb-2">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex gap-2 w-full max-w-[75%] mt-2 mb-2">
      <div className="flex-shrink-0 size-8 rounded-full bg-[var(--kapru-gold)] text-white flex items-center justify-center mt-1">
        <Sparkles size={16} />
      </div>
      <div className="flex flex-col gap-1 w-full">
        <div className="bg-white border border-[var(--kapru-teal-light)] text-[var(--kapru-ink)] rounded-2xl p-4">
          {message.content}
        </div>
      </div>
    </div>
  );
}
