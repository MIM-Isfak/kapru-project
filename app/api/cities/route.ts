import { NextResponse } from 'next/server';
import { callMcpTool } from '@/lib/mcp-client';

// Type for raw MCP callTool result
type McpToolResult = {
  content?: { type: string; text?: string }[];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    const result = await callMcpTool('kapruka_list_delivery_cities', {
      params: {
        query: q || null,
        limit: 10,
        response_format: 'json',
      },
    }) as McpToolResult;

    const textContent: string | undefined = result?.content?.[0]?.text;
    if (textContent) {
      const parsed = JSON.parse(textContent);
      return NextResponse.json({ cities: parsed.cities ?? [] });
    }

    return NextResponse.json({ cities: [] });
  } catch (error: unknown) {
    console.error('Cities API error:', error);
    return NextResponse.json({ cities: [] });
  }
}
