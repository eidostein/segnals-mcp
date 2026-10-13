/**
 * Tests for write strategy tools — create_strategy and set_indicator_filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerWriteStrategyTools } from "../../src/tools/write-strategies.js";

// Every API call in this file is a spy on the client; a call that reaches fetch is a bug.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network call not mocked")));
});

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
      config: { MARTINGALE: { ENABLED: true }, TRADING_PARAMS: { LEVERAGE: 15 } },
      confirm: false,
    });

    expect(postSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("create_strategy");
    expect(data.warnings.some((w: string) => w.includes("MARTINGALE.ENABLED"))).toBe(true);
    expect(data.warnings.some((w: string) => w.includes("15x (TRADING_PARAMS.LEVERAGE)"))).toBe(true);
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
  });

  // The config lands on a new bot's defaults: a stop-loss it does not name is not "no stop-loss".
  it("says a stop-loss the config does not name is left to the platform default", async () => {
    const { handlers } = createTestHarness();
    const handler = handlers.get("segnals_create_strategy");
    if (!handler) throw new Error("Tool not registered");

    const unnamed = JSON.parse(
      (await handler({ exchange: "bybit", name: "A", config: {}, confirm: false })).content[0].text,
    );
    const named = JSON.parse(
      (await handler({ exchange: "bybit", name: "B", config: { STOP_LOSS: { VALUE_PCT: 2 } }, confirm: false }))
        .content[0].text,
    );

    expect(unnamed.warnings).toHaveLength(1);
    expect(unnamed.warnings[0]).toContain("platform default");
    expect(named.warnings).toEqual([]);
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
      config: { TRADING_PARAMS: { LEVERAGE: 3 }, STOP_LOSS: { VALUE_PCT: 2 } },
      confirm: true,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.bot_id).toBe(99);
    expect(data.warnings).toEqual([]);
    expect(client.post).toHaveBeenCalledWith("/bots/create", { exchange: "phemex", client: "mcp" });
    expect(client.put).toHaveBeenCalledWith("/bots/99", {
      name: "Grid Strategy",
      config: { TRADING_PARAMS: { LEVERAGE: 3 }, STOP_LOSS: { VALUE_PCT: 2 } },
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
  // The engine reads INDICATOR_FILTER.<NAME>.*, and no gate at all while INDICATOR_FILTER.ENABLED is off.
  it("writes the INDICATOR_FILTER keys the engine reads", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated" });

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 5,
      filter_type: "adx",
      enabled: true,
      params: { period: 14, min: 25, MAX: 60 },
    });

    const written = {
      INDICATOR_FILTER: { ENABLED: true, ADX: { ENABLED: true, PERIOD: 14, MIN: 25, MAX: 60 } },
    };
    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.filter_type).toBe("adx");
    expect(data.written).toEqual(written);
    expect(client.put).toHaveBeenCalledWith("/bots/5", { config: written, client: "mcp" });
  });

  it("leaves the master switch alone when a gate is switched off", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated" });

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    await handler({ bot_id: 5, filter_type: "rsi", enabled: false });

    expect(client.put).toHaveBeenCalledWith("/bots/5", {
      config: { INDICATOR_FILTER: { RSI: { ENABLED: false } } },
      client: "mcp",
    });
  });

  // A key the gate does not read would be stored and never used: success that changes nothing.
  it("refuses a param the gate does not read, and writes nothing", async () => {
    const { handlers, client } = createTestHarness();
    const putSpy = vi.spyOn(client, "put");

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 5,
      filter_type: "adx",
      enabled: true,
      params: { period: 14, threshold: 25 },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'threshold' is not a setting of the ADX gate");
    expect(result.content[0].text).toContain("period, min, max");
    expect(putSpy).not.toHaveBeenCalled();
  });

  // The engine swaps a value it cannot read for its default without saying so.
  it("refuses a value of the wrong type, and writes nothing", async () => {
    const { handlers, client } = createTestHarness();
    const putSpy = vi.spyOn(client, "put");

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    const period = await handler({ bot_id: 5, filter_type: "ema", enabled: true, params: { fast: "20" } });
    const mode = await handler({ bot_id: 5, filter_type: "rsi", enabled: true, params: { mode: "strict" } });

    expect(period.isError).toBe(true);
    expect(period.content[0].text).toContain("'fast' must be a whole number above 0");
    expect(mode.isError).toBe(true);
    expect(mode.content[0].text).toContain("filter_extremes, require_band");
    expect(putSpy).not.toHaveBeenCalled();
  });

  it("passes the API's warning on", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated", warning: "Contradictory filter settings" });

    const handler = handlers.get("segnals_set_indicator_filter");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 5, filter_type: "atr", enabled: true, params: { min_pct: 0.5 } });

    const data = JSON.parse(result.content[0].text);
    expect(data.warning).toBe("Contradictory filter settings");
  });
});
