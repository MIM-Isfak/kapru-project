import { NextResponse } from 'next/server';
import { getMcpClient } from '@/lib/mcp-client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Type for raw MCP callTool result
type McpToolResult = {
  content?: { type: string; text?: string }[];
};

export async function GET(req: Request) {
  let mcpClient: Client | null = null;
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    mcpClient = await getMcpClient();
    const client = mcpClient as { callTool: (a: unknown) => Promise<McpToolResult>; close: () => Promise<void> };

    const result = await client.callTool({
      name: 'kapruka_list_delivery_cities',
      arguments: {
        params: {
          query: q || null,
          limit: 10,
          response_format: 'json',
        },
      },
    });

    const textContent: string | undefined = result?.content?.[0]?.text;
    if (textContent) {
      const parsed = JSON.parse(textContent);
      return NextResponse.json({ cities: parsed.cities ?? [] });
    }

    return NextResponse.json({ cities: [] });
  } catch (error: unknown) {
    console.error('Cities API error:', error);
    return NextResponse.json({ cities: [] });
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (e: unknown) {
        console.error('Failed to close MCP client (cities API):', e);
      }
    }
  }
}
