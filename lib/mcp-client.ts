import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FunctionDeclaration } from "@google/genai";

export async function getMcpClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.kapruka.com/mcp")
  );
  const client = new Client({ name: "kapru-agent", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function getMcpToolsAsGeminiDeclarations(
  client: Client
): Promise<FunctionDeclaration[]> {
  try {
    const { tools } = await client.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      // parametersJsonSchema accepts raw JSON Schema objects directly,
      // which is exactly what MCP's inputSchema provides.
      parametersJsonSchema: tool.inputSchema,
    }));
  } catch (err) {
    console.error("[mcp-client] Failed to list MCP tools:", err);
    return [];
  }
}
