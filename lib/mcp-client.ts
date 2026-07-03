import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FunctionDeclaration } from "@google/genai";

const MCP_URL = "https://mcp.kapruka.com/mcp";

// ─── Singleton MCP client ────────────────────────────────────────────────────
// Re-using one client across requests avoids ECONNRESET from repeatedly
// setting up and tearing down StreamableHTTP sessions.

let _client: Client | null = null;
let _connecting: Promise<Client> | null = null;

async function createFreshClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "kapru-agent", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function getMcpClient(): Promise<Client> {
  if (_client) return _client;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    const TIMEOUT_MS = 15_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("MCP connect timeout")), TIMEOUT_MS)
    );
    try {
      const client = await Promise.race([createFreshClient(), timeoutPromise]);
      _client = client;
      console.log("[mcp-client] Connected to Kapruka MCP.");
      return client;
    } catch (err) {
      _client = null;
      throw err;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}

/** Call this when a tool call fails so the stale client gets refreshed. */
export function invalidateMcpClient() {
  if (_client) {
    try { (_client as { close?: () => void }).close?.(); } catch { /* ignore */ }
  }
  _client = null;
  _connecting = null;
  _toolDeclarations = null;
}

// ─── JSON Schema $ref resolver ───────────────────────────────────────────────
// Gemini function-calling does NOT support $ref / $defs in the parameter
// schema. We must fully resolve all references before passing to the API.
// We also simplify anyOf: [type, null] into just the base type since Gemini
// doesn't handle nullable patterns well.

type JsonSchemaObject = Record<string, unknown>;

function resolveRefs(schema: unknown, defs: Record<string, unknown>): unknown {
  if (typeof schema !== "object" || schema === null) return schema;

  if (Array.isArray(schema)) {
    return schema.map((item) => resolveRefs(item, defs));
  }

  const obj = schema as JsonSchemaObject;

  // If this node is a $ref, resolve it
  if (typeof obj["$ref"] === "string") {
    const refPath = obj["$ref"]; // e.g. "#/$defs/SearchProductsInput"
    const parts = refPath.replace(/^#\//, "").split("/");
    const root: JsonSchemaObject = { $defs: defs };
    let resolved: unknown = root;
    for (const part of parts) {
      if (typeof resolved === "object" && resolved !== null) {
        resolved = (resolved as JsonSchemaObject)[part];
      } else {
        resolved = undefined;
        break;
      }
    }
    return resolveRefs(resolved, defs);
  }

  // Simplify anyOf: [{ type: "X" }, { type: "null" }]  →  { type: "X" }
  // Gemini doesn't handle nullable anyOf well — it just means optional.
  if (Array.isArray(obj["anyOf"])) {
    const variants = (obj["anyOf"] as unknown[]).filter(
      (v) => typeof v === "object" && v !== null && (v as JsonSchemaObject)["type"] !== "null"
    );
    if (variants.length === 1) {
      const inner = resolveRefs(variants[0], defs) as JsonSchemaObject;
      // Merge description / default from parent into inner
      const merged: JsonSchemaObject = { ...inner };
      if (obj["description"]) merged["description"] = obj["description"];
      if ("default" in obj) merged["default"] = obj["default"];
      return merged;
    }
  }

  // Recursively resolve all properties
  const result: JsonSchemaObject = {};
  for (const [key, value] of Object.entries(obj)) {
    // Drop $defs and $schema — Gemini doesn't need them after resolution
    if (key === "$defs" || key === "$schema" || key === "title") continue;
    result[key] = resolveRefs(value, defs);
  }
  return result;
}

/**
 * Takes a raw MCP inputSchema (which may contain $ref/$defs) and returns
 * a flat, fully-resolved schema that Gemini can understand.
 */
function flattenSchema(inputSchema: unknown): JsonSchemaObject {
  if (typeof inputSchema !== "object" || inputSchema === null) {
    return { type: "object", properties: {} };
  }

  const schema = inputSchema as JsonSchemaObject;
  const defs = (schema["$defs"] ?? {}) as Record<string, unknown>;

  // Resolve refs on the top-level schema
  const resolved = resolveRefs(schema, defs) as JsonSchemaObject;

  // If the top-level schema has a single "params" property that references
  // the real schema (common MCP pattern), unwrap it so Gemini sees the
  // actual parameters directly.
  const props = resolved["properties"] as JsonSchemaObject | undefined;
  if (props && Object.keys(props).length === 1 && "params" in props) {
    const paramsSchema = props["params"] as JsonSchemaObject;
    // Return the inner schema directly — properties, required, etc.
    if (paramsSchema["type"] === "object" || paramsSchema["properties"]) {
      return paramsSchema as JsonSchemaObject;
    }
  }

  return resolved;
}

/**
 * Robustly calls an MCP tool, automatically reconnecting if the transport was dropped.
 */
export async function callMcpTool(name: string, args: Record<string, unknown>) {
  let attempts = 0;
  while (attempts < 2) {
    try {
      const client = await getMcpClient();
      return await client.callTool({ name, arguments: args });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Not connected') || msg.includes('socket hung up') || msg.includes('ECONNRESET')) {
        console.warn(`[mcp-client] Connection dropped during ${name}. Reconnecting...`);
        invalidateMcpClient();
        attempts++;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`MCP Tool ${name} failed after reconnect attempt.`);
}

let _toolDeclarations: FunctionDeclaration[] | null = null;

export async function getMcpToolsAsGeminiDeclarations(
  client: Client
): Promise<FunctionDeclaration[]> {
  if (_toolDeclarations) return _toolDeclarations;
  try {
    const { tools } = await client.listTools();
    _toolDeclarations = tools.map((tool) => {
      const flatSchema = flattenSchema(tool.inputSchema);
      console.log(`[mcp-client] Tool "${tool.name}" resolved schema keys:`, Object.keys(flatSchema));
      return {
        name: tool.name,
        description: tool.description ?? "",
        parametersJsonSchema: flatSchema,
      };
    });
    return _toolDeclarations;
  } catch (err) {
    console.error("[mcp-client] Failed to list MCP tools:", err);
    return [];
  }
}
