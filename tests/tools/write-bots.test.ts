/**
 * Tests for write bot tools — two-step confirmation, risk detection, safety.
 */

import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerWriteBotTools } from "../../src/tools/write-bots.js";

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

  registerWriteBotTools(server, client);
  return { server, client, handlers };
}

describe("segnals_create_bot", () => {
  it("returns preview without mutation when confirm=false", async () => {
    const { handlers, client } = createTestHarness();
    const postSpy = vi.spyOn(client, "post");

    const handler = handlers.get("segnals_create_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ exchange: "bybit", confirm: false });

    expect(postSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("create_bot");
    expect(data.preview).toContain("BYBIT");
    expect(data.preview).toContain("will NOT begin trading");
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
    expect(data.instruction).toContain("confirm: true");
  });

  it("calls API when confirm=true", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({ msg: "Bot created successfully", bot_id: 42 });

    const handler = handlers.get("segnals_create_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ exchange: "bybit", confirm: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.bot_id).toBe(42);
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
    expect(client.post).toHaveBeenCalledWith("/bots/create", { exchange: "bybit", client: "mcp" });
  });
});

describe("segnals_update_bot", () => {
  it("flags risky config in preview", async () => {
    const { handlers, client } = createTestHarness();
    const putSpy = vi.spyOn(client, "put");

    const handler = handlers.get("segnals_update_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 1,
      config: { MARTINGALE_ENABLED: true, LEVERAGE: 25 },
      confirm: false,
    });

    expect(putSpy).not.toHaveBeenCalled();
    const data = JSON.parse(result.content[0].text);
    expect(data.warnings.length).toBeGreaterThan(0);
    expect(data.warnings.some((w: string) => w.includes("Martingale"))).toBe(true);
    expect(data.warnings.some((w: string) => w.includes("leverage"))).toBe(true);
  });

  it("rejects exchange credentials in config", async () => {
    const { handlers } = createTestHarness();
    const handler = handlers.get("segnals_update_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 1,
      config: { API_KEY: "secret123", LEVERAGE: 5 },
      confirm: false,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("REJECTED");
    expect(data.rejected_keys).toContain("API_KEY");
  });

  it("calls PUT when confirm=true", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "put").mockResolvedValue({ msg: "Bot updated" });

    const handler = handlers.get("segnals_update_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({
      bot_id: 5,
      name: "My Bot",
      config: { LEVERAGE: 3 },
      confirm: true,
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(client.put).toHaveBeenCalledWith("/bots/5", {
      name: "My Bot",
      config: { LEVERAGE: 3 },
      client: "mcp",
    });
  });
});

describe("segnals_start_bot", () => {
  it("mentions cold-start in preview", async () => {
    const { handlers } = createTestHarness();
    const handler = handlers.get("segnals_start_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 1, confirm: false });

    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("warming_up");
    expect(data.preview).toContain("cold-start");
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
  });

  it("calls control API when confirm=true", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({ status: "starting" });

    const handler = handlers.get("segnals_start_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 7, confirm: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.status).toBe("starting");
    expect(data.disclaimer).toContain("SOFTWARE TOOL");
    expect(client.post).toHaveBeenCalledWith("/bots/7/control", { action: "start", client: "mcp" });
  });
});

describe("segnals_stop_bot", () => {
  it("executes without confirmation (safe action)", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "post").mockResolvedValue({ status: "stopped" });

    const handler = handlers.get("segnals_stop_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 3 });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(data.status).toBe("stopped");
  });
});

describe("segnals_restart_bot", () => {
  it("warns about streak reset in preview", async () => {
    const { handlers } = createTestHarness();
    const handler = handlers.get("segnals_restart_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 1, confirm: false });

    const data = JSON.parse(result.content[0].text);
    expect(data.warnings.some((w: string) => w.includes("streak"))).toBe(true);
  });
});

describe("segnals_delete_bot", () => {
  it("warns about permanence in preview", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "get").mockResolvedValue({
      bot: { name: "TestBot", exchange: "bybit", status: "stopped" },
    });

    const handler = handlers.get("segnals_delete_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 10, confirm: false });

    const data = JSON.parse(result.content[0].text);
    expect(data.preview).toContain("PERMANENTLY");
    expect(data.warnings[0]).toContain("PERMANENT");
    expect(data.preview).toContain("TestBot");
  });

  it("calls DELETE when confirm=true", async () => {
    const { handlers, client } = createTestHarness();
    vi.spyOn(client, "del").mockResolvedValue({ msg: "Bot deleted" });

    const handler = handlers.get("segnals_delete_bot");
    if (!handler) throw new Error("Tool not registered");
    const result = await handler({ bot_id: 10, confirm: true });

    const data = JSON.parse(result.content[0].text);
    expect(data.executed).toBe(true);
    expect(client.del).toHaveBeenCalledWith("/bots/10");
  });
});
