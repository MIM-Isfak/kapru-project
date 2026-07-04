import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "https://mcp.kapruka.com/mcp";

async function main() {
  // Test 1: with response_format inside params
  console.log("=== Test 1: params.response_format = json ===");
  try {
    const transport1 = new StreamableHTTPClientTransport(new URL(MCP_URL));
    const client1 = new Client({ name: "kapru-agent", version: "1.0.0" });
    await client1.connect(transport1);
    const result1 = await client1.callTool({
      name: "kapruka_search_products",
      arguments: {
        params: {
          q: "chocolates",
          limit: 2,
          response_format: "json"
        }
      }
    });
    const text1 = result1?.content?.[0]?.text;
    console.log("Response (first 500):", text1?.substring(0, 500));
    try { const p = JSON.parse(text1); console.log("Parsed keys:", Object.keys(p)); } catch { console.log("NOT JSON"); }
    await client1.close();
  } catch (e) { console.error("Test1 fail:", e.message); }

  // Test 2: response_format at top level (not inside params)
  console.log("\n=== Test 2: top-level response_format = json ===");
  try {
    const transport2 = new StreamableHTTPClientTransport(new URL(MCP_URL));
    const client2 = new Client({ name: "kapru-agent", version: "1.0.0" });
    await client2.connect(transport2);
    const result2 = await client2.callTool({
      name: "kapruka_search_products",
      arguments: {
        params: {
          q: "chocolates",
          limit: 2,
        },
        response_format: "json"
      }
    });
    const text2 = result2?.content?.[0]?.text;
    console.log("Response (first 500):", text2?.substring(0, 500));
    try { const p = JSON.parse(text2); console.log("Parsed keys:", Object.keys(p)); } catch { console.log("NOT JSON"); }
    await client2.close();
  } catch (e) { console.error("Test2 fail:", e.message); }
}

main().catch(console.error);
