/**
 * Tests for news tools: get_news, get_sentiment (stub), get_market_price (stub), search_knowledge (stub)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerNewsTools } from "../../src/tools/news.js";

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
  registerNewsTools(mockServer, client);
  return handlers;
}

describe("News tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_get_news", () => {
    it("calls GET /newsfeed", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ articles: [{ title: "BTC Rally" }] }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_news({});
      const data = JSON.parse(result.content[0].text);

      expect(data.articles[0].title).toBe("BTC Rally");
      expect(mockFetch.mock.calls[0][0]).toContain("/newsfeed");
    });
  });

  describe("segnals_get_sentiment (stub)", () => {
    it("returns coming_soon status", async () => {
      const result = await handlers.segnals_get_sentiment({ symbol: "BTCUSDT" });
      const data = JSON.parse(result.content[0].text);

      expect(data.status).toBe("coming_soon");
      expect(data.message).toContain("coming");
    });
  });

  describe("segnals_get_market_price (stub)", () => {
    it("returns coming_soon status", async () => {
      const result = await handlers.segnals_get_market_price({ symbol: "ETHUSDT" });
      const data = JSON.parse(result.content[0].text);

      expect(data.status).toBe("coming_soon");
    });
  });

  describe("segnals_search_knowledge (stub)", () => {
    it("returns coming_soon status", async () => {
      const result = await handlers.segnals_search_knowledge({ query: "trailing stop" });
      const data = JSON.parse(result.content[0].text);

      expect(data.status).toBe("coming_soon");
      expect(data.message).toContain("docs");
    });
  });
});
