/**
 * Tests for write strategy tools — create_strategy and set_indicator_filter.
 */

import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerWriteStrategyTools } from "../../src/tools/write-strategies.js";

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

  registerWriteStrategyTools(server, client);
  return { server, client, handlers };
}

describe("segnals_create_strategy", () => {
  it("preview validates config and flags Martingale", async () => {
    const { handlers, client } = createTestHarness();
    const postSpy = vi.spyOn(client, "post");

    const handler = handlers.get("segnals_create_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      exchange: "bybit",
      name: "Scalper",
      config: { MARTINGALE_ENABLED: true, LEVERAGE: 15 },
      confirm: false,
    });

    expect(postSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("create_strategy");
    expect(data.warnings.some((w: string) => w.includes("Martingale"))).toBe(true);
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
  });

  it("rejects credentials in config", async () => {
    const { handlers } = createTestHarness();
    const handler = handlers.get("segnals_create_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      exchange: "bybit",
      name: "Test",
      config: { api_secret: "bad" },
      confirm: false,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("REJECTED");
  });

  it("orchestrates create+update when confirm=true", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({ msg: "Bot created", bot_id: 99 });
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated" });

    const handler = handlers.get("segnals_create_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      exchange: "phemex",
      name: "Grid Strategy",
      config: { LEVERAGE: 3, STOP_LOSS_PERCENT: 2 },
      confirm: true,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.bot_id).toBe(99);
    expect(client.post).toHaveBeenCalledWith("/bots/create", { exchange: "phemex", client: "mcp" });
    expect(client.put).toHaveBeenCalledWith("/bots/99", {
      name: "Grid Strategy",
      config: { LEVERAGE: 3, STOP_LOSS_PERCENT: 2 },
      client: "mcp",
    });
  });

  it("reports partial failure if update fails", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({ msg: "Bot created", bot_id: 50 });
    vi.spyOn(client, "put").mockRejectedValue(new Error("Config validation failed"));

    const handler = handlers.get("segnals_create_strategy");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      exchange: "bybit",
      name: "Broken",
      config: { INVALID_KEY: true },
      confirm: true,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.partial_failure).toBe(true);
    expect(data.bot_id).toBe(50);
  });
});

describe("segnals_set_indicator_filter", () => {
  it("updates filter config without confirmation", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated" });

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 5,
      filter_type: "adx",
      enabled: true,
      params: { period: 14, threshold: 25 },
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.filter_type).toBe("adx");
    expect(client.put).toHaveBeenCalledWith("/bots/5", {
      config: {
        FILTER_ADX_ENABLED: true,
        FILTER_ADX_PERIOD: 14,
        FILTER_ADX_THRESHOLD: 25,
      },
      client: "mcp",
    });
  });
});
