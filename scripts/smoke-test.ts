/**
 * Smoke test — verifies the tools register, then asks the BUILT server for its tool list.
 *
 * Usage: npm run build && npm run smoke
 * Requires: SEGNALS_API_KEY not needed (a dummy key is used; no API call is made)
 *
 * This test verifies:
 * 1. The server can be instantiated without errors
 * 2. All 33 tools are registered with valid names
 * 3. dist/index.js starts and answers `tools/list` over stdio with the same 33 tools
 */

import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../src/client.js";
import { registerAllTools } from "../src/tools/index.js";

const EXPECTED_TOOL_COUNT = 33;
const BUILT_SERVER = "dist/index.js";
const DUMMY_KEY = "sk_live_smoketest00000000";

// Use a dummy key — we're only testing registration, not API calls
const client = new SegnalsClient({
  apiKey: DUMMY_KEY,
  apiBase: "https://segnals.com/api",
  timeoutMs: 5000,
  maxRetries: 0,
});

const server = new McpServer({
  name: "segnals-mcp",
  version: "0.1.0",
});

// Intercept tool registrations to count them
const registeredTools: string[] = [];
const origTool = server.tool.bind(server) as any;
(server as any).tool = (...args: any[]) => {
  const name = args[0] as string;
  registeredTools.push(name);
  return origTool(...args);
};

// Register all tools
registerAllTools(server, client);

// Verify
console.log(`\n🔍 Smoke Test — Segnals MCP Server`);
console.log(`   Registered tools: ${registeredTools.length}`);
console.log(`   Expected tools:   ${EXPECTED_TOOL_COUNT}`);

if (registeredTools.length !== EXPECTED_TOOL_COUNT) {
  console.error(`\n❌ FAIL: Expected ${EXPECTED_TOOL_COUNT} tools, got ${registeredTools.length}`);
  console.error(`   Registered: ${registeredTools.join(", ")}`);
  process.exit(1);
}

// Verify all tools have the segnals_ prefix
const invalidNames = registeredTools.filter((name) => !name.startsWith("segnals_"));
if (invalidNames.length > 0) {
  console.error(`\n❌ FAIL: Tools without segnals_ prefix: ${invalidNames.join(", ")}`);
  process.exit(1);
}

// Verify no duplicate names
const uniqueNames = new Set(registeredTools);
if (uniqueNames.size !== registeredTools.length) {
  const dupes = registeredTools.filter((name, i) => registeredTools.indexOf(name) !== i);
  console.error(`\n❌ FAIL: Duplicate tool names: ${dupes.join(", ")}`);
  process.exit(1);
}

console.log(`\n✅ All ${EXPECTED_TOOL_COUNT} tools registered successfully:`);
for (const name of registeredTools) {
  console.log(`   • ${name}`);
}

// Ask the built server itself: what a client sees is `tools/list`, not the registration calls.
if (!existsSync(BUILT_SERVER)) {
  console.error(`\n❌ FAIL: ${BUILT_SERVER} not found. Run "npm run build" first.`);
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [BUILT_SERVER],
  env: { SEGNALS_API_KEY: DUMMY_KEY },
});
const mcpClient = new Client({ name: "segnals-mcp-smoke", version: "0.1.0" });
await mcpClient.connect(transport);
const { tools: listedTools } = await mcpClient.listTools();
await mcpClient.close();

const listedNames = listedTools.map((tool) => tool.name);
console.log(`\n🔍 tools/list from ${BUILT_SERVER}: ${listedNames.length} tools`);

const missing = registeredTools.filter((name) => !listedNames.includes(name));
const unexpected = listedNames.filter((name) => !registeredTools.includes(name));
if (listedNames.length !== EXPECTED_TOOL_COUNT || missing.length > 0 || unexpected.length > 0) {
  console.error(`\n❌ FAIL: tools/list does not match the ${EXPECTED_TOOL_COUNT} registered tools`);
  console.error(`   Missing:    ${missing.join(", ") || "none"}`);
  console.error(`   Unexpected: ${unexpected.join(", ") || "none"}`);
  process.exit(1);
}

// A listed tool must do what its description says: no placeholders.
const placeholders = listedTools.filter((tool) => /coming soon/i.test(tool.description ?? ""));
if (placeholders.length > 0) {
  console.error(`\n❌ FAIL: placeholder tools listed: ${placeholders.map((tool) => tool.name).join(", ")}`);
  process.exit(1);
}

console.log(`\n✅ Smoke test passed!\n`);
process.exit(0);
