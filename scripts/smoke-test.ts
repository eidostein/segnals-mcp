/**
 * Smoke test — verifies the tools register, then asks the BUILT server for its tool list.
 *
 * Usage: npm run build && npm run smoke
 * Requires: SEGNALS_API_KEY not needed (a dummy key is used; no API call is made)
 *
 * This test verifies:
 * 1. The server can be instantiated without errors
 * 2. All 37 tools are registered with valid names
 * 3. dist/index.js starts and answers `tools/list` over stdio with the same 37 tools,
 *    once with SEGNALS_API_KEY and once with an accounts file of two keys
 * 4. dist/index.js sends the server instructions and lists the resource template
 *    segnals://settings/{engine} with its four engines
 */

import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../src/client.js";
import { registerAllTools } from "../src/tools/index.js";

const EXPECTED_TOOL_COUNT = 37;
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
const instructions = mcpClient.getInstructions() ?? "";
const { resourceTemplates } = await mcpClient.listResourceTemplates();
const { resources } = await mcpClient.listResources();
await mcpClient.close();

// The built server tells the agent to read the catalog first, and offers it as a resource.
const templates = resourceTemplates.map((template) => template.uriTemplate);
const engines = resources.map((resource) => resource.uri);
console.log(`\n🔍 instructions: ${instructions.length} characters; resource templates: ${templates.join(", ")}`);
if (!instructions.includes("Read the settings catalog first") || !instructions.includes("Apply only what the person approved")) {
  console.error(`\n❌ FAIL: the built server sends no server instructions, or other ones`);
  process.exit(1);
}
if (JSON.stringify(templates) !== JSON.stringify(["segnals://settings/{engine}"])) {
  console.error(`\n❌ FAIL: resource templates are ${JSON.stringify(templates)}`);
  process.exit(1);
}
const wantEngines = ["mt5", "bybit", "phemex", "grid"].map((engine) => `segnals://settings/${engine}`);
if (JSON.stringify(engines) !== JSON.stringify(wantEngines)) {
  console.error(`\n❌ FAIL: resources/list answers ${JSON.stringify(engines)}`);
  process.exit(1);
}

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
const placeholders = listedTools.filter((tool) => /coming\s+soon|not\s+yet\s+available/i.test(tool.description ?? ""));
if (placeholders.length > 0) {
  console.error(`\n❌ FAIL: placeholder tools listed: ${placeholders.map((tool) => tool.name).join(", ")}`);
  process.exit(1);
}

// Several accounts: the built server started with an accounts file of two keys lists the same
// tools, and refuses a call that names no account with both labels, before any request.
const dir = mkdtempSync(join(tmpdir(), "segnals-smoke-"));
const accountsFile = join(dir, "accounts.json");
const labels = ["smoke-a", "smoke-b"];
try {
  writeFileSync(
    accountsFile,
    // Fake keys made at run time; nothing is sent with them.
    JSON.stringify({ accounts: labels.map((label) => ({ label, key: `sk_test_smoke_${randomBytes(12).toString("hex")}` })) }),
  );
  chmodSync(accountsFile, 0o600);
  const multi = new Client({ name: "segnals-mcp-smoke", version: "0.1.0" });
  await multi.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [BUILT_SERVER],
      env: { SEGNALS_ACCOUNTS_FILE: accountsFile },
    }),
  );
  const { tools: multiTools } = await multi.listTools();
  const refused = await multi.callTool({ name: "segnals_list_bots", arguments: {} });
  await multi.close();

  const multiNames = multiTools.map((tool) => tool.name).sort();
  const refusal = ((refused.content ?? []) as { type: string; text?: string }[]).map((c) => c.text ?? "").join("\n");
  console.log(`\n🔍 tools/list with an accounts file of ${labels.length} keys: ${multiNames.length} tools`);
  if (JSON.stringify(multiNames) !== JSON.stringify([...listedNames].sort())) {
    console.error(`\n❌ FAIL: with an accounts file, tools/list differs from the one-key list`);
    process.exit(1);
  }
  if (refused.isError !== true || !labels.every((label) => refusal.includes(`"${label}"`))) {
    console.error(`\n❌ FAIL: a call without account was not refused with both labels: ${refusal}`);
    process.exit(1);
  }
  console.log(`   A call without account is refused: ${refusal}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n✅ Smoke test passed!\n`);
process.exit(0);
