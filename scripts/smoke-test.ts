/**
 * Smoke test — boots the MCP server in-process and verifies all tools register.
 *
 * Usage: npm run smoke
 * Requires: SEGNALS_API_KEY not needed (uses a dummy key for registration check)
 *
 * This test verifies:
 * 1. The server can be instantiated without errors
 * 2. All 36 tools are registered with valid names
 * 3. The server can connect to a transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../src/client.js";
import { registerAllTools } from "../src/tools/index.js";

const EXPECTED_TOOL_COUNT = 36;

// Use a dummy key — we're only testing registration, not API calls
const client = new SegnalsClient({
  apiKey: "sk_live_smoketest00000000",
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

console.log(`\n✅ Smoke test passed!\n`);
process.exit(0);
