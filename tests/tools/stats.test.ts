/**
 * Tests for stats tools: get_dashboard, get_pnl_summary, get_bot_performance, get_trades
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerStatsTools } from "../../src/tools/stats.js";

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
  registerStatsTools(mockServer, client);
  return handlers;
}

describe("Stats tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_get_dashboard", () => {
    it("calls GET /bots/dashboard", async () => {
      const dashData = { total_pnl: 1500.50, win_rate: 65.2, active_bots: 3, total_bots: 5, total_trades: 120 };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(dashData), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_dashboard({});
      const data = JSON.parse(result.content[0].text);

      expect(data.total_pnl).toBe(1500.50);
      expect(data.win_rate).toBe(65.2);
      expect(mockFetch.mock.calls[0][0]).toContain("/bots/dashboard");
    });
  });

  describe("segnals_get_bot_performance", () => {
    it("calls GET /bots/<id>/performance with bot_id", async () => {
      const perfData = { net_pnl: 250.0, win_rate: 72.0, total_trades: 30 };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(perfData), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_bot_performance({ bot_id: 42 });
      const data = JSON.parse(result.content[0].text);

      expect(data.net_pnl).toBe(250.0);
      expect(mockFetch.mock.calls[0][0]).toContain("/bots/42/performance");
    });

    it("returns error for non-existent bot", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Bot not found" }), { status: 404 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_bot_performance({ bot_id: 999 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });
  });

  describe("segnals_get_trades", () => {
    it("calls GET /bots/trades with params", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ trades: [] }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      await handlers.segnals_get_trades({ bot_id: 5, limit: 20 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/bots/trades");
      expect(url).toContain("bot_id=5");
      expect(url).toContain("limit=20");
    });
  });
});
