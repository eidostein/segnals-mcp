/**
 * Tests for copy-trading tools: get_copy_trading, control_copy_trading
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerCopyTradingTools } from "../../src/tools/copy-trading.js";

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
  registerCopyTradingTools(mockServer, client);
  return handlers;
}

describe("Copy Trading tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_get_copy_trading", () => {
    it("calls GET /copy-trading/", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ enabled: true, status: "active" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_copy_trading({});
      const data = JSON.parse(result.content[0].text);

      expect(data.enabled).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toContain("/copy-trading/");
    });

    it("handles errors gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "insufficient_scope", required: "read:account" }), { status: 403 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_copy_trading({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("scope");
    });
  });

  describe("segnals_control_copy_trading", () => {
    it("returns preview when confirm=false", async () => {
      const handler = handlers.segnals_control_copy_trading;
      const result = await handler({ action: "start", exchange: "bybit", confirm: false });

      const data = JSON.parse(result.content[0].text);
      expect(data.action).toBe("control_copy_trading");
      expect(data.preview).toContain("start");
      expect(data.preview).toContain("BYBIT");
      expect(data.instruction).toContain("confirm: true");
    });

    it("calls API when confirm=true", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "running", msg: "Copy trader started for Bybit." }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const handler = handlers.segnals_control_copy_trading;
      const result = await handler({ action: "start", exchange: "bybit", confirm: true });

      const data = JSON.parse(result.content[0].text);
      expect(data.executed).toBe(true);
      expect(data.status).toBe("running");
    });
  });
});
