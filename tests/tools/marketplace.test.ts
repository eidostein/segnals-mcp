/**
 * Tests for marketplace tools: browse_marketplace, get_listing, my_listings
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerMarketplaceTools } from "../../src/tools/marketplace.js";

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
  registerMarketplaceTools(mockServer, client);
  return handlers;
}

describe("Marketplace tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_browse_marketplace", () => {
    it("calls GET /marketplace with pagination", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ listings: [], total: 0 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      await handlers.segnals_browse_marketplace({ page: 2, per_page: 10, exchange: "bybit" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/marketplace");
      expect(url).toContain("page=2");
      expect(url).toContain("per_page=10");
      expect(url).toContain("exchange=bybit");
    });
  });

  describe("segnals_get_listing", () => {
    it("calls GET /marketplace/<id>", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "abc", name: "Pro Strategy" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_listing({ listing_id: "abc" });
      const data = JSON.parse(result.content[0].text);

      expect(data.name).toBe("Pro Strategy");
      expect(mockFetch.mock.calls[0][0]).toContain("/marketplace/abc");
    });
  });

  describe("segnals_my_listings", () => {
    it("calls GET /marketplace/me/sales", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ listings: [], total_sales: 0 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      await handlers.segnals_my_listings({});

      expect(mockFetch.mock.calls[0][0]).toContain("/marketplace/me/sales");
    });
  });
});
