/**
 * What `tools/list` answers an agent (SPEC 453 §4.6 case 1): the tools of 0.1.1 unchanged in name
 * and schema, plus the fleet tools.
 *
 * The snapshot `__snapshots__/tools-0.1.1.json` was written by this test on the code before the
 * fleet read tools existed (SPEC 453 S3 merged, S9 not started). A change to the name or input
 * schema of any of those tools fails here.
 */

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Accounts } from "../src/accounts.js";
import { SegnalsClient } from "../src/client.js";
import { registerAllTools } from "../src/tools/index.js";

/** The eight tools SPEC 453 §3.9 adds to the tools of 0.1.1. Some arrive in later steps. */
const SPEC_453_TOOLS = [
  "segnals_list_accounts",
  "segnals_get_settings_catalog",
  "segnals_get_fleet",
  "segnals_plan_fleet",
  "segnals_apply_fleet_plan",
  "segnals_get_fleet_plan",
  "segnals_fleet_report",
  "segnals_stop_all_fleet",
];

async function listTools() {
  const client = new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 0,
  });
  const server = new McpServer({ name: "segnals-mcp", version: "test" });
  registerAllTools(server, Accounts.single(client));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const mcp = new Client({ name: "test", version: "test" });
  await mcp.connect(clientSide);
  return (await mcp.listTools()).tools;
}

describe("tools/list", () => {
  it("leaves the tools of 0.1.1 unchanged in name and schema (snapshot)", async () => {
    const tools = await listTools();
    const before = tools
      .filter((tool) => !SPEC_453_TOOLS.includes(tool.name))
      .map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema }))
      .sort((a, b) => a.name.localeCompare(b.name));

    expect(before).toHaveLength(33);
    await expect(`${JSON.stringify(before, null, 2)}\n`).toMatchFileSnapshot("./__snapshots__/tools-0.1.1.json");
  });
});
