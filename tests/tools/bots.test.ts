/**
 * Tests for bots tools: list_bots, get_bot, get_bot_logs, get_strategy_schema, explain_config
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerBotsTools } from "../../src/tools/bots.js";

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
  registerBotsTools(mockServer, client);
  return handlers;
}

describe("Bots tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_list_bots", () => {
    it("calls GET /bots/ and returns summaries", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            bots: [
              { id: 1, name: "BTC Scalper", exchange: "bybit", status: "running", symbol: "BTCUSDT" },
              { id: 2, name: "ETH Grid", exchange: "bybit", status: "stopped", symbol: "ETHUSDT" },
            ],
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_list_bots({});
      const data = JSON.parse(result.content[0].text);

      expect(data.total).toBe(2);
      expect(data.bots[0].name).toBe("BTC Scalper");
      expect(data.bots[1].status).toBe("stopped");
    });

    it("handles array response format", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: 1, name: "Bot1", exchange: "mt5", status: "running" },
          ]),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_list_bots({});
      const data = JSON.parse(result.content[0].text);

      expect(data.total).toBe(1);
    });
  });

  describe("segnals_get_bot", () => {
    it("calls GET /bots/<id>", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            bot: { id: 42, name: "My Bot", exchange: "bybit", status: "running", config: { leverage: 5 } },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_bot({ bot_id: 42 });
      const data = JSON.parse(result.content[0].text);

      expect(data.id).toBe(42);
      expect(data.config.leverage).toBe(5);
      expect(mockFetch.mock.calls[0][0]).toContain("/bots/42");
    });
  });

  describe("segnals_get_bot_logs", () => {
    it("calls GET /bots/<id>/logs", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ logs: ["entry1", "entry2"] }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_bot_logs({ bot_id: 42 });
      const data = JSON.parse(result.content[0].text);

      expect(data.logs).toHaveLength(2);
      expect(mockFetch.mock.calls[0][0]).toContain("/bots/42/logs");
    });
  });

  describe("segnals_explain_config", () => {
    it("flags Martingale as risky", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            bot: {
              id: 42,
              name: "Risky Bot",
              exchange: "bybit",
              status: "stopped",
              config: { martingale_enabled: true, leverage: 20 },
            },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_explain_config({ bot_id: 42 });
      const data = JSON.parse(result.content[0].text);

      expect(data.warnings.length).toBeGreaterThan(0);
      expect(data.warnings.some((w: string) => w.includes("MARTINGALE"))).toBe(true);
      expect(data.warnings.some((w: string) => w.includes("LEVERAGE"))).toBe(true);
    });

    it("shows no warnings for safe config", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            bot: { id: 10, name: "Safe Bot", exchange: "bybit", status: "running", config: { leverage: 3 } },
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_explain_config({ bot_id: 10 });
      const data = JSON.parse(result.content[0].text);

      expect(data.warnings[0]).toContain("No high-risk");
    });
  });
});
