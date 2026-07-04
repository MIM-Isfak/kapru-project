import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "https://mcp.kapruka.com/mcp";

async function main() {
  console.log("=== Full JSON response inspection ===");
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "kapru-agent", version: "1.0.0" });
  await client.connect(transport);
  
  const result = await client.callTool({
    name: "kapruka_search_products",
    arguments: {
      params: {
        q: "chocolates",
        limit: 2,
        response_format: "json"
      }
    }
  });
  
  const text = result?.content?.[0]?.text;
  const parsed = JSON.parse(text);
  
  console.log("\n--- TOP LEVEL KEYS ---");
  console.log(Object.keys(parsed));
  
  if (parsed.results && parsed.results.length > 0) {
    console.log("\n--- FIRST RESULT ALL FIELDS ---");
    console.log(JSON.stringify(parsed.results[0], null, 2));
  }
  
  await client.close();
}

main().catch(console.error);
