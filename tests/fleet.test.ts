/**
 * Tests for the fleet reads (SPEC 453 §3.9, §4.6 cases 2 and 5), through a real MCP server and
 * client: the settings catalog tool and resource, segnals_get_fleet, segnals_fleet_report, their
 * annotations and errors, and the server instructions.
 *
 * The API answers below copy the shapes of segnals-test `app/api/api_settings_catalog.py`,
 * `app/api/api_fleet.py` (`get_fleet`) and `app/services/fleet/report.py` (`build_report`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Accounts } from "../src/accounts.js";
import { SegnalsClient } from "../src/client.js";
import { SERVER_INSTRUCTIONS } from "../src/instructions.js";
import { registerSettingsResource } from "../src/resources/settings.js";
import { registerAllTools } from "../src/tools/index.js";
import { TOOL_CATALOG } from "../src/tools/meta.js";

const BASE = "https://api.test.segnals.com";
// Fake keys, made at run time so no key-shaped literal sits in the repository.
const KEY_A = `sk_test_plantedkey_${randomBytes(12).toString("hex")}`;
const KEY_B = `sk_test_plantedkey_${randomBytes(12).toString("hex")}`;

/** The eight tools SPEC 453 §3.9 adds, walked below. */
const SPEC_453_TOOLS = [
  "segnals_list_accounts",
  "segnals_get_settings_catalog",
  "segnals_get_fleet",
  "segnals_plan_fleet",
  "segnals_apply_fleet_plan",
  "segnals_get_fleet_plan",
  "segnals_fleet_report",
  "segnals_stop_all_fleet",
];

const CATALOG = {
  engine: "bybit",
  version: "4f1c0d5e9a7b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d",
  generated_from: "af8d6a778",
  settings: [
    {
      path: "TRADING_PARAMS.LEVERAGE",
      type: "int",
      default: 10,
      source: "default",
      unit: "ratio",
      range: { min: 1, max: 100 },
      depends_on: [],
      money: true,
      key_may_change: true,
      meaning_en: "Leverage the exchange applies.",
      meaning_de: "Hebel, den die Börse anwendet.",
      venues: ["bybit", "phemex"],
    },
    { path: "TRADING_PARAMS.SYMBOL", type: "str", default: "BTCUSDT", money: false, key_may_change: true },
    { path: "MARTINGALE.ENABLED", type: "bool", default: false, money: true, key_may_change: true },
    { path: "MARTINGALE.MULTIPLIER", type: "float", default: 2, money: true, key_may_change: true },
    { path: "API_KEY", type: "str", default: null, money: false, key_may_change: false },
  ],
};

const FLEET = {
  account: { tier: "vip", bot_limit: 50, bot_count: 12 },
  fleets: [
    {
      id: 3,
      status: "active",
      created_by: "user",
      issued_by_segnals: false,
      accepted_at: "2026-11-18T10:00:00+00:00",
      created_at: "2026-11-18T10:00:00+00:00",
      key: { id: "k1", prefix: "sk_test_ab12", mode: "test" },
      policy: { max_bots: 10, max_risk_per_bot_pct: 2, max_total_risk_pct: 10, allow_real_money: false },
      bot_ids: [9001, 9002],
      counts: { bots: 2, running: 1 },
      connections: [{ id: "c1", exchange: "bybit", demo: true, real_money_reason: null, currency: null, equity: null }],
    },
  ],
};

const UNMEASURED = {
  net_pnl: null,
  net_pnl_pct_of_capital: null,
  return_pct: null,
  win_rate_pct: null,
  profit_factor: null,
  expectancy: null,
  trades: 0,
  open_positions: null,
  unrealised_pnl: null,
  max_drawdown_pct: null,
  current_drawdown_pct: null,
  margin_used_pct: null,
  fees_swap: null,
};

const REPORT = {
  as_of: "2026-11-19T00:00:00+00:00",
  deployment: "staging",
  period: "7d",
  period_start: "2026-11-12T00:00:00+00:00",
  previous_start: "2026-11-05T00:00:00+00:00",
  fleets: [
    {
      fleet_id: 3,
      account_id: 4,
      tier: "vip",
      status: "active",
      account_currency: "USD",
      policy: { max_bots: 10, max_total_risk_pct: 10, allow_real_money: false },
      kpis: UNMEASURED,
      previous: UNMEASURED,
      bots: [
        {
          bot_id: 9001,
          exchange: "bybit",
          symbols: ["BTCUSDT"],
          demo: true,
          status: "running",
          kpis: UNMEASURED,
          previous: UNMEASURED,
          health: { last_sign_of_life_s: 41, source: "system_log", state: "running", errors_24h: 0 },
        },
      ],
    },
  ],
  totals: { currency: "USD", kpis: UNMEASURED, previous: UNMEASURED },
};

interface ToolAnswer {
  isError?: boolean;
  content: { type: string; text: string }[];
}

function client(apiKey: string): SegnalsClient {
  return new SegnalsClient({ apiKey, apiBase: BASE, timeoutMs: 5000, maxRetries: 0 });
}

const ONE = () => Accounts.single(client(KEY_A));
const TWO = () =>
  new Accounts([
    { label: "a", client: client(KEY_A) },
    { label: "b", client: client(KEY_B) },
  ]);

/** A connected MCP client of a server built the way `src/index.ts` builds it. */
async function connect(accounts: Accounts = ONE()): Promise<Client> {
  const server = new McpServer({ name: "segnals-mcp", version: "test" }, { instructions: SERVER_INSTRUCTIONS });
  registerAllTools(server, accounts);
  registerSettingsResource(server, accounts);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const mcp = new Client({ name: "test", version: "test" });
  await mcp.connect(clientSide);
  return mcp;
}

function textOf(answer: ToolAnswer): string {
  return answer.content.map((block) => block.text).join("\n");
}

/** The JSON a successful answer carries, after its `account:` line. */
function dataOf(answer: ToolAnswer): Record<string, unknown> {
  expect(answer.isError ?? false, textOf(answer)).toBe(false);
  return JSON.parse(answer.content[1].text) as Record<string, unknown>;
}

describe("Fleet reads", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function answer(status: number, body: unknown): void {
    fetchMock.mockImplementation(
      async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
    );
  }

  function requests(): { url: string; method: string; auth: string }[] {
    return fetchMock.mock.calls.map(([url, init]) => {
      const { method, headers } = init as RequestInit & { headers: Record<string, string> };
      return { url: String(url), method: String(method), auth: headers.Authorization };
    });
  }

  async function call(mcp: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolAnswer> {
    return (await mcp.callTool({ name, arguments: args })) as ToolAnswer;
  }

  /** A call the input schema refuses: the SDK answers an error result or a protocol error. */
  async function refused(mcp: Client, name: string, args: Record<string, unknown>): Promise<string> {
    try {
      const result = await call(mcp, name, args);
      expect(result.isError, name).toBe(true);
      return textOf(result);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  describe("segnals_get_settings_catalog", () => {
    it("reads GET /settings/catalog for the engine and answers its count and the API's version", async () => {
      answer(200, CATALOG);
      const mcp = await connect();

      const result = await call(mcp, "segnals_get_settings_catalog", { engine: "bybit" });

      expect(requests()).toEqual([{ url: `${BASE}/settings/catalog?engine=bybit`, method: "GET", auth: `Bearer ${KEY_A}` }]);
      expect(result.content[0].text).toBe("account: default");
      expect(dataOf(result)).toEqual({
        engine: "bybit",
        version: CATALOG.version,
        generated_from: CATALOG.generated_from,
        count: 5,
        settings: CATALOG.settings,
      });
    });

    it("narrows to the paths asked for, a full path or a block, and lists those that matched nothing", async () => {
      answer(200, CATALOG);
      const mcp = await connect();

      const data = dataOf(
        await call(mcp, "segnals_get_settings_catalog", {
          engine: "bybit",
          paths: ["MARTINGALE", "TRADING_PARAMS.LEVERAGE", "TRADING", "NOT.A.SETTING"],
        }),
      );

      expect(data.count).toBe(5);
      expect(data.version).toBe(CATALOG.version);
      expect(data.returned).toBe(3);
      expect((data.settings as { path: string }[]).map((setting) => setting.path)).toEqual([
        "TRADING_PARAMS.LEVERAGE",
        "MARTINGALE.ENABLED",
        "MARTINGALE.MULTIPLIER",
      ]);
      // "TRADING" is not a block: a block is a whole path segment.
      expect(data.not_found).toEqual(["TRADING", "NOT.A.SETTING"]);
    });

    it("offers the four engines and refuses another before sending anything", async () => {
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const schema = tools.find((tool) => tool.name === "segnals_get_settings_catalog")?.inputSchema as {
        properties: Record<string, { enum?: string[] }>;
        required?: string[];
      };

      expect(schema.properties.engine.enum).toEqual(["mt5", "bybit", "phemex", "grid"]);
      expect(schema.required).toEqual(["engine"]);
      await refused(mcp, "segnals_get_settings_catalog", { engine: "forex" });
      await refused(mcp, "segnals_get_settings_catalog", { engine: "mt5", paths: [] });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("says what to do next when the API refuses the engine, or predates the catalog", async () => {
      const mcp = await connect();

      answer(400, { error: "unknown_engine", message: "engine must be one of: mt5, bybit, phemex, grid" });
      let text = textOf(await call(mcp, "segnals_get_settings_catalog", { engine: "grid" }));
      expect(text).toContain("engine must be one of");
      expect(text).toContain("What to do next: Use one of the engines mt5, bybit, phemex, grid.");

      answer(404, { error: "engine_not_served", message: "the grid catalog is not served yet" });
      text = textOf(await call(mcp, "segnals_get_settings_catalog", { engine: "grid" }));
      expect(text).toContain("What to do next: This server does not serve that engine's catalog yet.");

      // An older server: Flask's own 404 page, no JSON.
      answer(404, "<!doctype html><title>404 Not Found</title>");
      const old = await call(mcp, "segnals_get_settings_catalog", { engine: "grid" });
      expect(old.isError).toBe(true);
      expect(textOf(old)).toContain("predates SPEC 453");
      expect(textOf(old)).toContain("do not guess setting names");

      answer(200, { engine: "grid" });
      const empty = await call(mcp, "segnals_get_settings_catalog", { engine: "grid" });
      expect(empty.isError).toBe(true);
      expect(textOf(empty)).toContain("holds no settings list.\n\nWhat to do next: ");
    });
  });

  describe("segnals_get_fleet", () => {
    it("reads GET /fleet and passes its answer through", async () => {
      answer(200, FLEET);
      const mcp = await connect();

      const result = await call(mcp, "segnals_get_fleet");

      expect(requests()).toEqual([{ url: `${BASE}/fleet`, method: "GET", auth: `Bearer ${KEY_A}` }]);
      expect(result.content[0].text).toBe("account: default");
      expect(dataOf(result)).toEqual(FLEET);
    });

    it("says what to do next for each refusal, chosen by the API's error code", async () => {
      const mcp = await connect();
      const NEW_KEY = "Ask the person for a new key for this account";
      const cases: [number, unknown, string][] = [
        // A key never gets the 404 of a switched-off bot manager, so a 404 means the route is missing.
        [404, { error: "not_found", message: "Not found" }, "it predates the bot manager"],
        [403, { error: "fleet_manager_off", message: "The bot manager is switched off." }, "a master key works only while it is on"],
        [403, { error: "fleet_disabled", message: "This master key's fleet is disabled." }, "can enable it in Settings → Bot manager"],
        [403, { error: "key_not_accepted", message: "Not accepted yet." }, "They accept or decline it in Settings → Bot manager"],
        [403, { error: "master_key_only", message: "Only a master key or the dashboard reads the fleet." }, "This account's key is not a master key"],
        [403, { error: "insufficient_scope", message: "This action requires the 'manage:fleet' scope", required: "manage:fleet" }, "never holds manage:fleet"],
        [403, { error: "protected_bot", message: "This bot is protected." }, "Tell the person what Segnals answered"],
        [401, { error: "invalid_api_key", message: "Invalid or revoked API key" }, NEW_KEY],
        [401, { error: "expired_api_key", message: "API key has expired" }, NEW_KEY],
        [401, { error: "ip_not_allowed", message: "Request IP not in key's allowlist" }, "do not ask for a new key"],
        [429, { error: "rate_limit_exceeded", message: "Rate limit exceeded.", retry_after: 30 }, "then retry once"],
        [500, { error: "internal", message: "boom" }, "Retry once in a minute"],
      ];

      for (const [status, body, next] of cases) {
        answer(status, body);
        const result = await call(mcp, "segnals_get_fleet");
        expect(result.isError, next).toBe(true);
        expect(result.content[0].text).toBe("account: default");
        expect(textOf(result), next).toContain("\n\nWhat to do next: ");
        expect(textOf(result), next).toContain(next);
        if (next !== NEW_KEY) expect(textOf(result), next).not.toContain(NEW_KEY);
      }

      fetchMock.mockImplementation(async () => {
        throw new TypeError("fetch failed");
      });
      expect(textOf(await call(mcp, "segnals_get_fleet"))).toContain("What to do next: Check that SEGNALS_API_BASE");
    });

    it("never tells the agent to add manage:fleet to a key", async () => {
      answer(403, { error: "insufficient_scope", message: "This action requires the 'manage:fleet' scope", required: "manage:fleet" });
      const mcp = await connect();

      const text = textOf(await call(mcp, "segnals_get_fleet"));
      expect(text).toContain("this key lacks the scope `manage:fleet` that this read needs");
      expect(text).not.toContain("Add it to your key");
      expect(text).not.toContain("create a new key with this scope");
    });
  });

  describe("segnals_fleet_report", () => {
    it("reads GET /fleet/report for 7d by default, and keeps a KPI that is not measured null", async () => {
      answer(200, REPORT);
      const mcp = await connect();

      const data = dataOf(await call(mcp, "segnals_fleet_report"));

      expect(requests()).toEqual([{ url: `${BASE}/fleet/report?period=7d`, method: "GET", auth: `Bearer ${KEY_A}` }]);
      expect(data).toEqual(REPORT);
      const [fleet] = data.fleets as { kpis: Record<string, unknown> }[];
      expect(fleet.kpis.net_pnl).toBeNull();
      expect(fleet.kpis.win_rate_pct).toBeNull();
    });

    it("names what a bot holds now, and passes it through: trades 0 is not flat (segnals-test #2379)", async () => {
      // Staging bot 199 held an AVAX short for two hours while the report read trades 0 and net P&L 0.00.
      const held = { ...UNMEASURED, open_positions: 1, unrealised_pnl: 11.11, margin_used_pct: 0.26 };
      const none = { ...UNMEASURED, open_positions: null, unrealised_pnl: null };
      const [fleet] = REPORT.fleets;
      const [bot] = fleet.bots;
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "AVAXUSDT"];
      const report = {
        ...REPORT,
        fleets: [{ ...fleet, kpis: held, previous: none, bots: [{ ...bot, symbols, kpis: held, previous: none }] }],
        totals: { currency: "USD", kpis: held, previous: none },
      };
      answer(200, report);
      const mcp = await connect();

      const { tools } = await mcp.listTools();
      const description = tools.find((tool) => tool.name === "segnals_fleet_report")?.description ?? "";
      for (const field of ["open_positions", "unrealised_pnl", "margin_used_pct"]) expect(description).toContain(field);
      expect(description).toContain("trades and net_pnl count closed trades only");

      const data = dataOf(await call(mcp, "segnals_fleet_report"));
      expect(data).toEqual(report);
    });

    it("sends the period asked for, and refuses another before sending", async () => {
      answer(200, { ...REPORT, period: "30d" });
      const mcp = await connect();

      await call(mcp, "segnals_fleet_report", { period: "30d" });
      await call(mcp, "segnals_fleet_report", { period: "24h" });
      await refused(mcp, "segnals_fleet_report", { period: "1y" });

      expect(requests().map((request) => request.url)).toEqual([
        `${BASE}/fleet/report?period=30d`,
        `${BASE}/fleet/report?period=24h`,
      ]);
    });

    it("reads a 404 as a switched-off bot manager or an older server, never as a missing route only", async () => {
      // A manual key holding read:stats passes the scope check and meets `_switch_on`'s 404 while the bot
      // manager is off (segnals-test api_fleet_reports.get_fleet_report), unlike GET /fleet.
      answer(404, { error: "not_found", message: "Not found" });
      const mcp = await connect();

      const report = textOf(await call(mcp, "segnals_fleet_report"));
      expect(report).toContain("What to do next: The fleet report answered 404: the server's bot manager is switched off, or the server predates it");
      expect(report).not.toContain("This server has no fleet routes");

      const fleet = textOf(await call(mcp, "segnals_get_fleet"));
      expect(fleet).toContain("What to do next: This server has no fleet routes");
    });

    it("says what to do next when the key is not a master key", async () => {
      answer(403, { error: "master_key_only", message: "Only a master key or the dashboard reads the fleet report." });
      const mcp = await connect();

      const text = textOf(await call(mcp, "segnals_fleet_report"));
      expect(text).toContain("Segnals refused this request (403): Only a master key or the dashboard reads the fleet report.");
      expect(text).toContain("What to do next: This account's key is not a master key.");
    });
  });

  describe("several accounts", () => {
    it("reads the fleet and its report with the named account's key only", async () => {
      answer(200, FLEET);
      const mcp = await connect(TWO());

      const fleet = await call(mcp, "segnals_get_fleet", { account: "b" });
      const report = await call(mcp, "segnals_fleet_report", { account: "b" });
      const catalog = await call(mcp, "segnals_get_settings_catalog", { account: "b", engine: "mt5" });

      for (const result of [fleet, report, catalog]) expect(result.content[0].text).toBe("account: b");
      expect(requests().map((request) => request.auth)).toEqual([`Bearer ${KEY_B}`, `Bearer ${KEY_B}`, `Bearer ${KEY_B}`]);
    });
  });

  describe("annotations (case 5)", () => {
    it("marks every SPEC 453 read readOnlyHint, and every SPEC 453 change destructiveHint", async () => {
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const walked = tools.filter((tool) => SPEC_453_TOOLS.includes(tool.name));

      // All eight: S3 and S9 built four, S11 the plan tools.
      expect(walked.map((tool) => tool.name).sort()).toEqual([...SPEC_453_TOOLS].sort());
      expect(walked).toHaveLength(8);
      for (const tool of walked) {
        const type = TOOL_CATALOG.find((entry) => entry.name === tool.name)?.type;
        if (type === "read") {
          expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
          expect(tool.annotations?.destructiveHint, tool.name).not.toBe(true);
        } else {
          expect(type, tool.name).toBe("write");
          expect(tool.annotations?.destructiveHint, tool.name).toBe(true);
        }
      }
    });
  });

  describe("the resource segnals://settings/{engine} (case 2)", () => {
    it("is one template that lists the four engines, without a request", async () => {
      const mcp = await connect();

      const { resourceTemplates } = await mcp.listResourceTemplates();
      expect(resourceTemplates.map((template) => [template.uriTemplate, template.mimeType])).toEqual([
        ["segnals://settings/{engine}", "application/json"],
      ]);
      const { resources } = await mcp.listResources();
      expect(resources.map((resource) => resource.uri)).toEqual([
        "segnals://settings/mt5",
        "segnals://settings/bybit",
        "segnals://settings/phemex",
        "segnals://settings/grid",
      ]);
      const completion = await mcp.complete({
        ref: { type: "ref/resource", uri: "segnals://settings/{engine}" },
        argument: { name: "engine", value: "p" },
      });
      expect(completion.completion.values).toEqual(["phemex"]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reads the API's catalog for the engine, with the first account's key", async () => {
      answer(200, CATALOG);
      const mcp = await connect(TWO());

      const { contents } = await mcp.readResource({ uri: "segnals://settings/bybit" });

      expect(requests()).toEqual([{ url: `${BASE}/settings/catalog?engine=bybit`, method: "GET", auth: `Bearer ${KEY_A}` }]);
      expect(contents).toHaveLength(1);
      const [content] = contents as { uri: string; mimeType: string; text: string; _meta?: Record<string, unknown> }[];
      expect(content.uri).toBe("segnals://settings/bybit");
      expect(content.mimeType).toBe("application/json");
      expect(JSON.parse(content.text)).toEqual(CATALOG);
      expect(content._meta).toEqual({ account: "a" });
    });

    it("refuses an unknown engine without a request, and names the tool when the API fails, never the key", async () => {
      const mcp = await connect(TWO());

      await expect(mcp.readResource({ uri: "segnals://settings/forex" })).rejects.toThrow(
        "The engines are mt5, bybit, phemex, grid.",
      );
      expect(fetchMock).not.toHaveBeenCalled();

      answer(401, { error: "invalid_api_key", message: "API key revoked" });
      const failure = await mcp.readResource({ uri: "segnals://settings/mt5" }).then(
        () => "",
        (error: Error) => error.message,
      );
      expect(failure).toContain("Your Segnals API key is invalid or expired");
      expect(failure).toContain('The resource reads with the account "a"');
      expect(failure).toContain("segnals_get_settings_catalog reads with the account you name");
      expect(failure).not.toContain(KEY_A);
      expect(failure).not.toContain("plantedkey");
    });
  });

  describe("server instructions", () => {
    it("say: read the catalog first, plan per account, show the diff, apply only what was approved", async () => {
      for (const rule of [
        "Read the settings catalog first",
        "Plan per account",
        "Show the person the diff before anything is applied",
        "Apply only what the person approved",
        "Never say a real-money bot started until the plan says applied",
        // The fleet step is for a master key only: a manual key never reads a fleet.
        "If the account's key is a master key (it reads a fleet), read the fleet with segnals_get_fleet",
        "A key from Settings → API Keys has no fleet; skip this step for it.",
      ]) {
        expect(SERVER_INSTRUCTIONS).toContain(rule);
      }
      const mcp = await connect();
      expect(mcp.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    });

    it("name only tools this server has", () => {
      const named = [...new Set(SERVER_INSTRUCTIONS.match(/segnals_[a-z_]+/g) ?? [])];
      const tools = TOOL_CATALOG.map((tool) => tool.name);

      expect(named.length).toBeGreaterThanOrEqual(4);
      expect(named.filter((name) => !tools.includes(name))).toEqual([]);
    });
  });
});
