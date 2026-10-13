/**
 * Tests for the tool registry as a whole: what `tools/list` offers an agent.
 */

import { describe, it, expect } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerAllTools } from "../../src/tools/index.js";
import { TOOL_CATALOG } from "../../src/tools/meta.js";

function registeredTools(): { name: string; description: string }[] {
  const client = new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 0,
  });
  const tools: { name: string; description: string }[] = [];
  const mockServer = {
    tool: (name: string, description: string) => {
      tools.push({ name, description });
    },
  } as unknown as McpServer;
  registerAllTools(mockServer, client);
  return tools;
}

describe("Tool registry", () => {
  // A tool an agent sees must return data: the API has no route for these three yet.
  it("lists no placeholder tool", () => {
    const tools = registeredTools();
    const names = tools.map((tool) => tool.name);

    expect(names).not.toContain("segnals_get_sentiment");
    expect(names).not.toContain("segnals_get_market_price");
    expect(names).not.toContain("segnals_search_knowledge");
    expect(tools.filter((tool) => /coming soon|not yet available/i.test(tool.description))).toEqual([]);
  });

  it("registers exactly the 33 tools the capabilities catalog names", () => {
    const names = registeredTools().map((tool) => tool.name);

    expect(names).toHaveLength(33);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(TOOL_CATALOG.map((tool) => tool.name).sort());
  });
});
