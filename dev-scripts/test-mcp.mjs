import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  console.log("Connecting to MCP...");
  const transport = new StreamableHTTPClientTransport(
    new URL("https://mcp.kapruka.com/mcp")
  );
  const client = new Client({ name: "kapru-agent", version: "1.0.0" });
  await client.connect(transport);

  console.log("Listing tools...");
  const { tools } = await client.listTools();
  console.log("Available tools:", tools.map(t => t.name));

  const searchTool = tools.find(t => t.name === 'kapruka_search_products');
  if (searchTool) {
    console.log("Search inputSchema:", JSON.stringify(searchTool.inputSchema, null, 2));
  }

  const query = "chocolates";
  console.log(`Calling kapruka_search_products with: "${query}"`);
  
  try {
    const result = await client.callTool({
      name: "kapruka_search_products",
      arguments: {
        params: {
          q: query,
          response_format: "json"
        }
      }
    });
    console.log("RAW RESULT STATUS:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calling tool:", err);
  }

  await client.close();
}

main().catch(console.error);
