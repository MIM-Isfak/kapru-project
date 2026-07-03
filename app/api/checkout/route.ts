import { NextResponse } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';

// Type for the raw MCP callTool result
type McpToolResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      if (attempt >= 3) throw error;
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('resource_exhausted')) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        attempt++;
      } else {
        throw error;
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      recipient: unknown; delivery: unknown; sender: unknown;
      gift_message?: unknown; cart: unknown;
    };
    const { recipient, delivery, sender, gift_message, cart } = body;

    const result = await withRetry(() => callMcpTool('kapruka_create_order', {
      params: {
        cart,
        recipient,
        delivery,
        sender,
        gift_message: gift_message ?? null,
        response_format: 'json',
      },
    })) as McpToolResult;

    // MCP wraps response as { content: [{ type: 'text', text: '...' }] }
    const textContent: string | undefined = result?.content?.[0]?.text;

    if (!textContent) {
      return NextResponse.json(
        { success: false, error: 'Empty response from payment service.' },
        { status: 502 }
      );
    }

    // If the tool returned an error flag
    if (result.isError) {
      return NextResponse.json(
        { success: false, error: textContent },
        { status: 400 }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(textContent);
    } catch {
      // Not valid JSON — check if it's a plain error string
      if (textContent.startsWith('Error')) {
        return NextResponse.json(
          { success: false, error: textContent },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Unexpected response from payment service.' },
        { status: 502 }
      );
    }

    if (parsed.checkout_url) {
      return NextResponse.json({ success: true, ...parsed });
    }

    // Parsed but no checkout_url — treat as an error payload
    const errorMsg =
      typeof parsed === 'string'
        ? parsed
        : parsed.message ?? parsed.error ?? 'Order could not be created.';

    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });

  } catch (error: unknown) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong, please try again.' },
      { status: 500 }
    );
  }
}
