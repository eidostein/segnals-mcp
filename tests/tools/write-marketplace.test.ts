/**
 * Tests for marketplace write tools — copy_strategy and publish_listing.
 */

import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerWriteMarketplaceTools } from "../../src/tools/write-marketplace.js";

function createMockClient(): SegnalsClient {
  return new SegnalsClient({
    apiKey: "sk_live_testkey12345678",
    apiBase: "https://segnals.com/api",
    timeoutMs: 5000,
    maxRetries: 0,
  });
}

function createTestHarness() {
  const server = new McpServer({ name: "test", version: "0.1.0" });
  const client = createMockClient();
  const handlers = new Map<string, (args: any) => Promise<any>>();

  const origTool = server.tool.bind(server) as any;
  vi.spyOn(server, "tool").mockImplementation((...args: any[]) => {
    const name = args[0] as string;
    const handler = args[args.length - 1] as (args: any) => Promise<any>;
    handlers.set(name, handler);
    return origTool(...args);
  });

  registerWriteMarketplaceTools(server, client);
  return { server, client, handlers };
}

describe("segnals_copy_strategy", () => {
  it("preview shows listing details and disclaimer", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "get").mockResolvedValue({
      id: "abc",
      title: "Alpha Scalper",
      seller_name: "TraderJoe",
      exchange: "bybit",
      price_usd: 0,
      perf_source: "live",
    });
    const postSpy = vi.spyOn(client, "post");

    const handler = handlers.get("segnals_copy_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ listing_id: "abc", confirm: false });

    expect(postSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("Alpha Scalper");
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
    expect(data.listing.price_usd).toBe(0);
  });

  it("paid copy preview shows price warning", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "get").mockResolvedValue({
      id: "paid1",
      title: "Premium Strategy",
      seller_name: "ProTrader",
      exchange: "bybit",
      price_usd: 49.99,
      perf_source: "live",
    });

    const handler = handlers.get("segnals_copy_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ listing_id: "paid1", confirm: false });

    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("$49.99");
    expect(data.warnings.some((w: string) => w.includes("paid"))).toBe(true);
  });

  it("free copy executes and returns bot_id", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({
      msg: "Strategy copied",
      bot_id: 55,
      status: "paid",
    });

    const handler = handlers.get("segnals_copy_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ listing_id: "free1", confirm: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.bot_id).toBe(55);
    expect(data.status).toBe("copied");
  });

  it("paid copy returns invoice URL", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({
      msg: "Order created",
      status: "pending",
      invoice_url: "https://nowpayments.io/payment/123",
      payment_id: 456,
    });

    const handler = handlers.get("segnals_copy_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ listing_id: "paid2", confirm: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("pending_payment");
    expect(data.invoice_url).toContain("nowpayments");
  });
});

describe("segnals_publish_listing", () => {
  it("preview shows listing details", async () => {
    const { handlers, client } = createTestHarness();
    const postSpy = vi.spyOn(client, "post");

    const handler = handlers.get("segnals_publish_listing");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      source_bot_id: 10,
      title: "My Strategy",
      description: "A great strategy",
      price_usd: 29.99,
      confirm: false,
    });

    expect(postSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("My Strategy");
    expect(data.preview).toContain("$29.99");
    expect(data.preview).toContain("admin review");
  });

  it("executes and returns listing_id", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({
      msg: "Strategy submitted for review.",
      listing_id: 77,
    });

    const handler = handlers.get("segnals_publish_listing");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      source_bot_id: 10,
      title: "My Strategy",
      description: "A great strategy",
      price_usd: 0,
      confirm: true,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.listing_id).toBe(77);
    expect(data.status).toBe("pending_review");
  });
});
