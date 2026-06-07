/**
 * Tests for meta tools: whoami, get_capabilities, get_safety_disclaimer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerMetaTools, TOOL_CATALOG, SAFETY_DISCLAIMER } from "../../src/tools/meta.js";

function createMockClient(): SegnalsClient {
  return new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 0,
  });
}

/**
 * Helper to register tools and extract the handler by name.
 * The McpServer.tool() method registers handlers; we intercept the registration.
 */
function extractToolHandlers(client: SegnalsClient) {
  const handlers: Record<string, (...args: any[]) => any> = {};

  const mockServer = {
    tool: (name: string, _description: string, _schema: any, handler: any) => {
      handlers[name] = handler;
    },
  } as unknown as McpServer;

  registerMetaTools(mockServer, client);
  return handlers;
}

describe("Meta tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_whoami", () => {
    it("returns user profile on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            username: "testuser",
            tier: "gold",
            language: "en",
            subscription_ends_at: "2026-12-31",
            has_completed_onboarding: true,
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_whoami({});
      const data = JSON.parse(result.content[0].text);

      expect(data.username).toBe("testuser");
      expect(data.tier).toBe("gold");
      expect(data.status).toBe("connected");
      expect(result.isError).toBeUndefined();
    });

    it("returns guidance on auth failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "invalid_api_key", message: "bad key" }),
          { status: 401 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_whoami({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Settings → API Keys");
      expect(result.content[0].text).toContain("segnals.com");
    });
  });

  describe("segnals_get_capabilities", () => {
    it("returns the tool catalog", async () => {
      const result = await handlers.segnals_get_capabilities({});
      const data = JSON.parse(result.content[0].text);

      expect(data.server).toBe("segnals-mcp");
      expect(data.tools).toEqual(TOOL_CATALOG);
      expect(data.tools.length).toBe(36);
    });
  });

  describe("segnals_get_safety_disclaimer", () => {
    it("returns the disclaimer text", async () => {
      const result = await handlers.segnals_get_safety_disclaimer({});
      const data = JSON.parse(result.content[0].text);

      expect(data.disclaimer).toBe(SAFETY_DISCLAIMER);
      expect(data.disclaimer).toContain("NOT financial advice");
      expect(data.disclaimer).toContain("risk");
    });
  });
});
