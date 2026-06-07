/**
 * Tests for account tools: get_account, get_subscription, list_connections
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerAccountTools } from "../../src/tools/account.js";

function createMockClient(): SegnalsClient {
  return new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 0,
  });
}

function extractToolHandlers(client: SegnalsClient) {
  const handlers: Record<string, (...args: any[]) => any> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: any, handler: any) => {
      handlers[name] = handler;
    },
  } as unknown as McpServer;
  registerAccountTools(mockServer, client);
  return handlers;
}

describe("Account tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_get_account", () => {
    it("calls GET /user/me and returns account details", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            username: "testuser",
            tier: "gold",
            subscription_ends_at: "2026-12-31",
            trial_expires_at: null,
            language: "en",
            has_completed_onboarding: true,
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_account({});
      const data = JSON.parse(result.content[0].text);

      expect(data.username).toBe("testuser");
      expect(data.tier).toBe("gold");
      expect(mockFetch.mock.calls[0][0]).toContain("/user/me");
    });
  });

  describe("segnals_get_subscription", () => {
    it("calls GET /user/billing", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ plan: "gold", active: true }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_subscription({});
      const data = JSON.parse(result.content[0].text);

      expect(data.plan).toBe("gold");
      expect(mockFetch.mock.calls[0][0]).toContain("/user/billing");
    });
  });

  describe("segnals_list_connections", () => {
    it("calls GET /user/connections-status and returns booleans only", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            connections: { mt5: true, bybit: false, phemex: false, telegram: true },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_list_connections({});
      const data = JSON.parse(result.content[0].text);

      expect(data.connections.mt5).toBe(true);
      expect(data.connections.bybit).toBe(false);
      expect(data.connections.telegram).toBe(true);

      // Verify it calls the safe endpoint, not /connections
      expect(mockFetch.mock.calls[0][0]).toContain("/user/connections-status");
      expect(mockFetch.mock.calls[0][0]).not.toMatch(/\/connections$/);

      // Verify no secrets in output
      const text = result.content[0].text;
      expect(text).not.toContain("api_key");
      expect(text).not.toContain("secret");
      expect(text).not.toContain("password");
    });
  });
});
