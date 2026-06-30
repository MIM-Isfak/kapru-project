import { NextResponse } from 'next/server';
import { getMcpClient } from '@/lib/mcp-client';

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000];
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt >= 3) throw error;
      const msg = error?.message?.toLowerCase() || String(error).toLowerCase();
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
  let mcpClient: any = null;
  try {
    const body = await req.json();
    const { recipient, delivery, sender, gift_message, cart } = body;

    mcpClient = await getMcpClient();

    const result = await withRetry(() => mcpClient.callTool({
      name: 'kapruka_create_order',
      arguments: {
        params: {
          cart,
          recipient,
          delivery,
          sender,
          gift_message: gift_message ?? null,
          response_format: 'json',
        },
      },
    }));

    // MCP wraps response as { content: [{ type: 'text', text: '...' }] }
    const textContent: string | undefined = result?.content?.[0]?.text;

    if (!textContent) {
      return NextResponse.json(
        { success: false, error: 'Empty response from payment service.' },
        { status: 502 }
      );
    }

    // If the tool returned an error flag
    if (result?.isError) {
      return NextResponse.json(
        { success: false, error: textContent },
        { status: 400 }
      );
    }

    let parsed: any;
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

  } catch (error) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong, please try again.' },
      { status: 500 }
    );
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (e) {
        console.error('Failed to close MCP client (checkout):', e);
      }
    }
  }
}
