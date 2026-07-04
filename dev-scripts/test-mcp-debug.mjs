import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "https://mcp.kapruka.com/mcp";

async function main() {
  console.log("Testing MCP connection with retry...");
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`\n--- Attempt ${attempt} ---`);
      const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
      const client = new Client({ name: "kapru-agent", version: "1.0.0" });
      await client.connect(transport);
      console.log("Connected!");
      
      // Try the search
      console.log("Calling kapruka_search_products...");
      const result = await client.callTool({
        name: "kapruka_search_products",
        arguments: {
          params: {
            q: "chocolates",
            limit: 3,
          }
        }
      });
      
      console.log("SUCCESS! Result type:", typeof result);
      const text = result?.content?.[0]?.text;
      if (text) {
        console.log("Response (first 800 chars):", text.substring(0, 800));
        // Try JSON parse
        try {
          const parsed = JSON.parse(text);
          console.log("\nParsed keys:", Object.keys(parsed));
          if (parsed.results) console.log("Results count:", parsed.results.length, "First result keys:", Object.keys(parsed.results[0] || {}));
          if (parsed.products) console.log("Products count:", parsed.products.length);
          if (parsed.items) console.log("Items count:", parsed.items.length);
        } catch {
          console.log("(not JSON)");
        }
      }
      
      await client.close();
      break;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message || err);
      if (attempt < 3) {
        console.log("Waiting 2s before retry...");
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

main().catch(console.error);
