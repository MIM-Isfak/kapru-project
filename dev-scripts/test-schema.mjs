import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "https://mcp.kapruka.com/mcp";

function resolveRefs(schema, defs) {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(item => resolveRefs(item, defs));
  
  const obj = schema;
  if (typeof obj["$ref"] === "string") {
    const refPath = obj["$ref"];
    const parts = refPath.replace(/^#\//, "").split("/");
    const root = { $defs: defs };
    let resolved = root;
    for (const part of parts) {
      if (typeof resolved === "object" && resolved !== null) {
        resolved = resolved[part];
      } else { resolved = undefined; break; }
    }
    return resolveRefs(resolved, defs);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$defs" || key === "$schema" || key === "title") continue;
    result[key] = resolveRefs(value, defs);
  }
  return result;
}

function flattenSchema(inputSchema) {
  if (typeof inputSchema !== "object" || inputSchema === null) return { type: "object", properties: {} };
  const defs = (inputSchema["$defs"] ?? {});
  const resolved = resolveRefs(inputSchema, defs);
  const props = resolved["properties"];
  if (props && Object.keys(props).length === 1 && "params" in props) {
    const paramsSchema = props["params"];
    if (paramsSchema["type"] === "object" || paramsSchema["properties"]) {
      return paramsSchema;
    }
  }
  return resolved;
}

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  
  const { tools } = await client.listTools();
  const searchTool = tools.find(t => t.name === "kapruka_search_products");
  
  console.log("=== RAW schema (top-level keys) ===");
  console.log(Object.keys(searchTool.inputSchema));
  
  const flat = flattenSchema(searchTool.inputSchema);
  console.log("\n=== FLATTENED schema ===");
  console.log(JSON.stringify(flat, null, 2));
  
  console.log("\n=== Properties Gemini will see ===");
  console.log(Object.keys(flat.properties || {}));
  
  // Now test calling with the flattened args pattern
  console.log("\n=== Testing call with flattened args ===");
  const result = await client.callTool({
    name: "kapruka_search_products",
    arguments: {
      params: {
        q: "chocolates",
        limit: 3,
        response_format: "json"
      }
    }
  });
  
  const text = result?.content?.[0]?.text;
  const parsed = JSON.parse(text);
  console.log(`Got ${parsed.results?.length} results!`);
  console.log("First result:", parsed.results?.[0]?.name, "- LKR", parsed.results?.[0]?.price?.amount);
  
  await client.close();
}

main().catch(console.error);
