import { FunctionCall } from "@google/genai";
import { ChatMessage } from "@/lib/types";

export type AgentStage = "discovery" | "checkout";

export function determineStage(
  functionCalls: FunctionCall[],
  finalResponseText: string,
  messages: ChatMessage[]
): AgentStage {
  if (functionCalls && functionCalls.length > 0) {
    const hasCheckoutTool = functionCalls.some(call => call?.name === "kapruka_create_order");
    if (hasCheckoutTool) return "checkout";
  }
  
  const text = (finalResponseText || "").toLowerCase();
  
  const checkoutKeywords = [
    "recipient name",
    "recipient phone",
    "delivery address",
    "delivery city",
    "delivery date",
    "gift message",
    "buy",
    "order",
    "checkout"
  ];
  
  const isCollectingDetails = checkoutKeywords.some(kw => text.includes(kw));
  if (isCollectingDetails) {
    return "checkout";
  }

  const previousAssistantMessages = messages.filter(m => m.role === 'assistant');
  const lastAssistantMessage = previousAssistantMessages[previousAssistantMessages.length - 1];
  
  if (lastAssistantMessage && lastAssistantMessage.stage === 'checkout') {
    // Check if user is asking to search again
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {
      const userText = lastUserMessage.content.toLowerCase();
      if (userText.includes("search") || userText.includes("find") || userText.includes("look for")) {
        return "discovery";
      }
    }
    return "checkout";
  }
  
  return "discovery";
}
