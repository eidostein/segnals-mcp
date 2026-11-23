/**
 * Tests for the fleet plan tools (SPEC 453 §3.9, §4.6 cases 3 and 4), through a real MCP server and
 * client: segnals_plan_fleet, segnals_get_fleet_plan, segnals_apply_fleet_plan and
 * segnals_stop_all_fleet, and the 403 `use_fleet_plans` a master key gets from the tools of 0.1.1.
 *
 * The plan answers copy the shape of segnals-test `app/services/fleet/plans.py` (`plan_answer`) and
 * the routes of `app/api/api_fleet.py` (S4). Apply and stop all are S7's, written against SPEC 453
 * §3.5 and §3.8.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Accounts } from "../src/accounts.js";
import { SegnalsClient } from "../src/client.js";
import { SERVER_INSTRUCTIONS } from "../src/instructions.js";
import { idempotencyKey } from "../src/tools/fleet-plans.js";
import { registerAllTools } from "../src/tools/index.js";
import { argumentsFor, type JsonSchema } from "./schema-sample.js";

const BASE = "https://api.test.segnals.com";
// Fake keys, made at run time so no key-shaped literal sits in the repository.
const KEY_A = `sk_test_plantedkey_${randomBytes(12).toString("hex")}`;
const KEY_B = `sk_test_plantedkey_${randomBytes(12).toString("hex")}`;

const PLAN_ID = randomUUID();

/**
 * The eight tools SPEC 453 §3.9 adds; the others are the 31 of 0.1.1 that remain (its two copy
 * trading tools were removed with copy trading, segnals-test #2094).
 */
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
/** Tools that answer from the program itself and send no request. */
const LOCAL_TOOLS = ["segnals_get_capabilities", "segnals_get_safety_disclaimer"];

const ITEMS = [
  {
    action: "create",
    exchange: "bybit",
    connection_id: "c1",
    name: "BTC grid 1",
    config: { TRADING_PARAMS: { LEVERAGE: 3 } },
    start: true,
  },
  { action: "create", exchange: "bybit", connection_id: "c1", from: { bot_id: 9001 }, config: {} },
];

function plan(status: string, more: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    plan_id: PLAN_ID,
    fleet_id: 3,
    status,
    plan_sha: "9f2c".padEnd(64, "0"),
    expires_at: "2026-11-20T09:00:00+00:00",
    created_at: "2026-11-19T09:00:00+00:00",
    counts: { create: 2, update: 0, start: 0, stop: 0, delete: 0, new_running: 1 },
    accounts: [{ connection_id: "c1", currency: "USD", total_worst_case_usd: 12.5, cap_usd: 100 }],
    caps: { max_bots: 10, max_total_risk_pct: 10 },
    capacity: null,
    needs_confirmation: 0,
    refusals: [],
    warnings: [],
    items: [
      {
        position: 0,
        action: "create",
        bot_id: null,
        exchange: "bybit",
        connection_id: "c1",
        real_money: false,
        needs_confirmation: false,
        diff: [{ path: "TRADING_PARAMS.LEVERAGE", before: 10, after: 3 }],
        risk: { worst_case_usd: 6.25 },
        status: "pending",
      },
      {
        position: 1,
        action: "create",
        bot_id: null,
        exchange: "bybit",
        connection_id: "c1",
        real_money: false,
        needs_confirmation: false,
        diff: [],
        risk: { worst_case_usd: 6.25 },
        status: "pending",
      },
    ],
    ...more,
  };
}

interface ToolAnswer {
  isError?: boolean;
  content: { type: string; text: string }[];
}

function client(apiKey: string, maxRetries = 0): SegnalsClient {
  return new SegnalsClient({ apiKey, apiBase: BASE, timeoutMs: 5000, maxRetries });
}

/** A connected MCP client of a server built the way `src/index.ts` builds it. */
async function connect(accounts: Accounts = Accounts.single(client(KEY_A))): Promise<Client> {
  const server = new McpServer({ name: "segnals-mcp", version: "test" }, { instructions: SERVER_INSTRUCTIONS });
  registerAllTools(server, accounts);
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

describe("Fleet plans", () => {
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

  interface Sent {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }

  function requests(): Sent[] {
    return fetchMock.mock.calls.map(([url, init]) => {
      const { method, headers, body } = init as RequestInit & { headers: Record<string, string> };
      return {
        url: String(url),
        method: String(method),
        headers,
        body: typeof body === "string" ? JSON.parse(body) : undefined,
      };
    });
  }

  async function call(mcp: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolAnswer> {
    return (await mcp.callTool({ name, arguments: args })) as ToolAnswer;
  }

  /** A call the input schema refuses: the SDK answers an error result or a protocol error. */
  async function refused(mcp: Client, name: string, args: Record<string, unknown>): Promise<string> {
    try {
      const result = await call(mcp, name, args);
      expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
      return textOf(result);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  describe("segnals_plan_fleet", () => {
    it("sends the items to POST /fleet/plans with the account's key and passes the checked plan through", async () => {
      answer(201, plan("checked"));
      const mcp = await connect();

      const result = await call(mcp, "segnals_plan_fleet", { items: ITEMS });

      expect(requests()).toEqual([
        {
          url: `${BASE}/fleet/plans`,
          method: "POST",
          headers: { Authorization: `Bearer ${KEY_A}`, Accept: "application/json", "Content-Type": "application/json" },
          body: { items: ITEMS },
        },
      ]);
      expect(result.content[0].text).toBe("account: default");
      const data = dataOf(result);
      const { next_step: next, ...rest } = data;
      expect(rest).toEqual(plan("checked"));
      expect(next).toContain("Nothing has changed yet. Show the person this plan before anything is applied");
      expect(next).toContain(`segnals_apply_fleet_plan({ plan_id: "${PLAN_ID}" })`);
    });

    it("refuses a field the action does not take, by name, risk_acknowledged among them, and sends nothing", async () => {
      const mcp = await connect();

      const acknowledged = await refused(mcp, "segnals_plan_fleet", {
        items: [{ action: "start", bot_id: 9001, risk_acknowledged: true }],
      });
      expect(acknowledged).toContain("risk_acknowledged");
      const startOnUpdate = await refused(mcp, "segnals_plan_fleet", {
        items: [{ action: "update", bot_id: 9002, config: { STOP_LOSS: { PERCENTAGE: 1.2 } }, start: true }],
      });
      expect(startOnUpdate).toContain('"start"');
      await refused(mcp, "segnals_plan_fleet", {
        items: [{ action: "create", exchange: "bybit", connection_id: "c1", from: { bot_id: 1, risk_acknowledged: true } }],
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("takes every field the API takes, a null name included", async () => {
      answer(201, plan("checked"));
      const mcp = await connect();
      const items = [
        { action: "create", exchange: "mt5", connection_id: "c2", name: null, from: "default", config: {}, start: false },
        { action: "update", bot_id: 9001, config: { MARTINGALE: { ENABLED: false } } },
        { action: "start", bot_id: 9001 },
        { action: "stop", bot_id: 9002 },
        { action: "delete", bot_id: 9003 },
      ];

      dataOf(await call(mcp, "segnals_plan_fleet", { items }));
      expect(requests().map((request) => request.body)).toEqual([{ items }]);
    });

    it("refuses a plan that names a credential, at any depth and in any case, without sending it or its value", async () => {
      const mcp = await connect();
      const planted = `planted-secret-${randomBytes(8).toString("hex")}`;
      const cases: [unknown[], string][] = [
        [[{ action: "update", bot_id: 1, config: { API_KEY: planted } }], "items[0].config.API_KEY"],
        [
          [{ action: "start", bot_id: 1 }, { action: "update", bot_id: 2, config: { EXCHANGE_ACCOUNT: { Api_Secret: planted } } }],
          "items[1].config.EXCHANGE_ACCOUNT.Api_Secret",
        ],
        [[{ action: "create", exchange: "mt5", connection_id: "c1", config: { MT5_PASSWORD: planted } }], "items[0].config.MT5_PASSWORD"],
        [
          [{ action: "create", exchange: "bybit", connection_id: "c1", config: { LEGS: [{ passphrase: planted }] } }],
          "items[0].config.LEGS[0].passphrase",
        ],
      ];

      for (const [items, path] of cases) {
        const result = await call(mcp, "segnals_plan_fleet", { items });
        expect(result.isError, path).toBe(true);
        expect(textOf(result), path).toContain(`a plan never holds a credential, and this one names ${path}.`);
        expect(textOf(result), path).toContain("Never ask the person for a key, secret or password.");
        expect(textOf(result), path).not.toContain(planted);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a malformed plan before sending anything", async () => {
      const mcp = await connect();
      const tooMany = Array.from({ length: 501 }, () => ({ action: "stop", bot_id: 1 }));

      for (const items of [
        [],
        tooMany,
        [{ action: "pause", bot_id: 1 }],
        [{ action: "create", connection_id: "c1" }], // no exchange
        [{ action: "create", exchange: "binance", connection_id: "c1" }],
        [{ action: "create", exchange: "bybit", connection_id: "" }],
        [{ action: "create", exchange: "bybit", connection_id: "c1", from: "copy" }],
        [{ action: "update", bot_id: 1 }], // no config
        [{ action: "start", bot_id: 0 }],
        [{ action: "delete", bot_id: 2 ** 31 }],
        [{ action: "stop", bot_id: "12" }],
      ]) {
        await refused(mcp, "segnals_plan_fleet", { items });
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("says a refused plan can never be applied, and passes every refusal through", async () => {
      const refusals = [{ item: 0, path: "TRADING_PARAMS.LEVERAGE", code: "out_of_range", message: "1 to 100" }];
      answer(201, plan("refused", { refusals }));
      const mcp = await connect();

      const data = dataOf(await call(mcp, "segnals_plan_fleet", { items: ITEMS }));

      expect(data.status).toBe("refused");
      expect(data.refusals).toEqual(refusals);
      expect(data.next_step).toContain("This plan was refused and can never be applied; nothing changed.");
      expect(data.next_step).not.toContain("segnals_apply_fleet_plan");
    });

    it("says what to do next for the API's refusals of a check", async () => {
      const mcp = await connect();
      const cases: [number, unknown, string][] = [
        [429, { error: "rate_limited", message: "A fleet checks at most 30 plans an hour.", retry_after: 1200 }, "30 plan checks, 10 applies and 3 stop-alls an hour"],
        [400, { error: "invalid_plan", message: 'Send {"items": [...]} with 1 to 500 items.' }, "Send items as a list of 1 to 500 changes"],
        [403, { error: "master_key_only", message: "Only a fleet's master key checks a plan." }, "This account's key is not a master key"],
        [403, { error: "fleet_manager_off", message: "The bot manager is switched off." }, "a master key works only while it is on"],
        [404, "<!doctype html><title>404 Not Found</title>", "This server has no plan routes"],
      ];

      for (const [status, body, next] of cases) {
        answer(status, body);
        const result = await call(mcp, "segnals_plan_fleet", { items: ITEMS });
        expect(result.isError, next).toBe(true);
        expect(textOf(result), next).toContain(`\n\nWhat to do next: `);
        expect(textOf(result), next).toContain(next);
      }

      answer(403, { error: "insufficient_scope", message: "This action requires the 'manage:fleet' scope", required: "manage:fleet" });
      const scope = textOf(await call(mcp, "segnals_plan_fleet", { items: ITEMS }));
      expect(scope).toContain("this key lacks the scope `manage:fleet` that this request needs");
      expect(scope).not.toContain("Add it to your key");
    });
  });

  describe("segnals_get_fleet_plan", () => {
    it("reads GET /fleet/plans/<id> and says what to do next for each status", async () => {
      const mcp = await connect();
      const cases: [string, string][] = [
        ["checked", "Nothing has changed yet."],
        ["applying", "Starts are released in batches"],
        ["applied", "It is applied: every item is done"],
        ["applied_with_errors", "It is applied with errors"],
        ["awaiting_confirmation", "you cannot confirm it, and never say those bots started until this plan says applied"],
        ["failed", "rolled back: no bot changed"],
        ["expired", "It ended without being applied (expired)"],
      ];

      for (const [status, next] of cases) {
        answer(200, plan(status));
        const data = dataOf(await call(mcp, "segnals_get_fleet_plan", { plan_id: PLAN_ID }));
        expect(data.status).toBe(status);
        expect(data.next_step, status).toContain(next);
      }
      expect(new Set(requests().map((request) => `${request.method} ${request.url}`))).toEqual(
        new Set([`GET ${BASE}/fleet/plans/${PLAN_ID}`]),
      );
    });

    it("tells a plan the key may not see from a server without the route", async () => {
      const mcp = await connect();

      answer(404, { error: "not_found", message: "Plan not found" });
      expect(textOf(await call(mcp, "segnals_get_fleet_plan", { plan_id: PLAN_ID }))).toContain(
        "What to do next: No plan with this id is visible to this key",
      );

      answer(404, "<!doctype html><title>404 Not Found</title>");
      expect(textOf(await call(mcp, "segnals_get_fleet_plan", { plan_id: PLAN_ID }))).toContain(
        "What to do next: This server has no plan routes",
      );
    });

    it("refuses a plan_id that is not a plan's id before sending anything", async () => {
      const mcp = await connect();

      for (const plan_id of ["", "12", "../../bots/11", `${PLAN_ID}/apply`]) {
        await refused(mcp, "segnals_get_fleet_plan", { plan_id });
        await refused(mcp, "segnals_apply_fleet_plan", { plan_id, confirm: true });
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("segnals_apply_fleet_plan (case 3)", () => {
    it("without confirm reads the stored plan and sends nothing that writes", async () => {
      answer(200, plan("checked"));
      const mcp = await connect();

      for (const args of [{ plan_id: PLAN_ID }, { plan_id: PLAN_ID, confirm: false }]) {
        const data = dataOf(await call(mcp, "segnals_apply_fleet_plan", args));
        expect(data.action).toBe("apply_fleet_plan");
        expect(data.can_apply).toBe(true);
        expect(data.preview).toBe(
          "Will apply 2 items (2 create); 1 bot(s) will start running; 0 item(s) act on real money; " +
            "0 wait for the account holder's confirmation.",
        );
        expect(data.instruction).toContain("Only once the person approves exactly this plan");
        expect(data.instruction).toContain("confirm: true");
        expect(data.plan).toEqual(plan("checked"));
      }

      const sent = requests();
      expect(sent).toHaveLength(2);
      expect(sent.map((request) => request.method)).toEqual(["GET", "GET"]);
      expect(sent.map((request) => request.url)).toEqual([
        `${BASE}/fleet/plans/${PLAN_ID}`,
        `${BASE}/fleet/plans/${PLAN_ID}`,
      ]);
      expect(sent.some((request) => "Idempotency-Key" in request.headers)).toBe(false);
    });

    it("previews a plan that is not checked as one it cannot apply", async () => {
      const mcp = await connect();

      for (const status of ["refused", "applied", "expired"]) {
        answer(200, plan(status));
        const data = dataOf(await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID }));
        expect(data.can_apply, status).toBe(false);
        expect(data.preview).toBe(`This plan is ${status} and cannot be applied.`);
        expect(data.instruction).not.toContain("confirm: true");
      }
      expect(requests().every((request) => request.method === "GET")).toBe(true);
    });

    it("with confirm sends one apply, with an Idempotency-Key derived from the plan id", async () => {
      answer(200, plan("applied"));
      const mcp = await connect();

      const result = await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true });

      expect(requests()).toEqual([
        {
          url: `${BASE}/fleet/plans/${PLAN_ID}/apply`,
          method: "POST",
          headers: {
            "Idempotency-Key": `segnals-mcp-apply-${PLAN_ID}`,
            Authorization: `Bearer ${KEY_A}`,
            Accept: "application/json",
          },
          body: undefined,
        },
      ]);
      const data = dataOf(result);
      expect(data.status).toBe("applied");
      expect(data.next_step).toContain("It is applied");
    });

    it("sends the same key for the same plan every time, and another for another plan", async () => {
      answer(200, plan("applying"));
      const mcp = await connect();
      const other = randomUUID();

      await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true });
      await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true });
      await call(mcp, "segnals_apply_fleet_plan", { plan_id: other, confirm: true });

      const keys = requests().map((request) => request.headers["Idempotency-Key"]);
      expect(keys).toEqual([idempotencyKey(PLAN_ID), idempotencyKey(PLAN_ID), idempotencyKey(other)]);
      expect(keys[0]).not.toBe(keys[2]);
      expect(keys.every((key) => key.length <= 128)).toBe(true); // fleet_plans.idempotency_key is 128 wide
    });

    it("sends the apply once, even with client retries on, and says to read the plan before applying again", async () => {
      const mcp = await connect(Accounts.single(client(KEY_A, 3)));

      answer(502, { message: "bad gateway" });
      const failed = textOf(await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true }));
      fetchMock.mockImplementation(async () => {
        throw new TypeError("fetch failed");
      });
      const unreached = textOf(await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true }));

      expect(requests().map((request) => `${request.method} ${request.url}`)).toEqual([
        `POST ${BASE}/fleet/plans/${PLAN_ID}/apply`,
        `POST ${BASE}/fleet/plans/${PLAN_ID}/apply`,
      ]);
      for (const text of [failed, unreached]) {
        expect(text).toContain("What to do next: Segnals may or may not have received this apply.");
        expect(text).toContain("Read the plan with segnals_get_fleet_plan before anything else");
      }
    });

    it("says what to do next when the apply is refused", async () => {
      const mcp = await connect();
      const cases: [number, unknown, string][] = [
        [409, { error: "plan_stale", message: "The plan is stale." }, "Check the plan again with segnals_plan_fleet"],
        [409, { error: "wrong_status", message: "The plan is refused." }, "This plan cannot be applied in its present status"],
        [410, { error: "plan_expired", message: "The plan expired." }, "This plan cannot be applied in its present status"],
        [409, { error: "fleet_stopped_all", message: "The fleet was stopped." }, "only the account holder can resume it"],
        [429, { error: "rate_limited", message: "A fleet applies at most 10 plans an hour." }, "10 applies"],
        [404, { error: "not_found", message: "Plan not found" }, "No plan with this id is visible to this key"],
        [404, "<!doctype html><title>404 Not Found</title>", "This server cannot apply plans yet"],
        [403, { error: "fleet_disabled", message: "This master key's fleet is disabled." }, "can enable it in Settings → Bot manager"],
      ];

      for (const [status, body, next] of cases) {
        answer(status, body);
        const result = await call(mcp, "segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true });
        expect(result.isError, next).toBe(true);
        expect(textOf(result), next).toContain(`\n\nWhat to do next: `);
        expect(textOf(result), next).toContain(next);
      }
    });
  });

  describe("segnals_stop_all_fleet", () => {
    it("sends POST /fleet/stop-all at once, with no preview, and passes the answer through", async () => {
      const stopped = { fleet_id: 3, status: "stopped_all", stopped: [9001, 9002], skipped: [{ bot_id: 11, reason: "protected_bot" }] };
      answer(200, stopped);
      const mcp = await connect();

      const data = dataOf(await call(mcp, "segnals_stop_all_fleet"));

      expect(requests()).toEqual([
        {
          url: `${BASE}/fleet/stop-all`,
          method: "POST",
          headers: { Authorization: `Bearer ${KEY_A}`, Accept: "application/json" },
          body: undefined,
        },
      ]);
      const { next_step: next, ...rest } = data;
      expect(rest).toEqual(stopped);
      expect(next).toContain("which were skipped (they still run)");
      expect(next).toContain("you cannot resume it");
    });

    it("says nothing was stopped when it fails, and that the account holder can stop each bot", async () => {
      const mcp = await connect();
      const cases: [number, unknown, string][] = [
        [404, "<!doctype html><title>404 Not Found</title>", "This server has no stop-all route (SPEC 453 S7), so nothing was stopped."],
        [404, { error: "not_found", message: "Not found" }, "Segnals found no fleet of this key to stop"],
        [429, { error: "rate_limited", message: "At most 3 stop-alls an hour." }, "3 stop-alls an hour"],
        [403, { error: "fleet_disabled", message: "This master key's fleet is disabled." }, "can enable it in Settings → Bot manager"],
        [500, { message: "boom" }, "Segnals may or may not have received this stop all"],
      ];

      for (const [status, body, next] of cases) {
        answer(status, body);
        const text = textOf(await call(mcp, "segnals_stop_all_fleet"));
        expect(text, next).toContain(next);
        expect(text, next).toContain("assume every bot of the fleet still runs: tell the person at once");
        expect(text, next).toContain("can stop each bot from the dashboard");
      }
    });
  });

  it("sends a stop all once, even with client retries on: the hour allows 3", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    const mcp = await connect(Accounts.single(client(KEY_A, 3)));

    const text = textOf(await call(mcp, "segnals_stop_all_fleet"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).toContain("What to do next: Segnals may or may not have received this stop all.");
    expect(text).toContain("if its status is not stopped_all, send segnals_stop_all_fleet again");
    expect(text).toContain("assume every bot of the fleet still runs");
  });

  describe("annotations and descriptions", () => {
    it("marks the plan check and the plan read readOnlyHint, and apply and stop all destructiveHint", async () => {
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const hints = Object.fromEntries(
        tools
          .filter((tool) => ["segnals_plan_fleet", "segnals_get_fleet_plan", "segnals_apply_fleet_plan", "segnals_stop_all_fleet"].includes(tool.name))
          .map((tool) => [tool.name, [tool.annotations?.readOnlyHint, tool.annotations?.destructiveHint]]),
      );

      expect(hints).toEqual({
        segnals_plan_fleet: [true, false],
        segnals_get_fleet_plan: [true, false],
        segnals_apply_fleet_plan: [false, true],
        segnals_stop_all_fleet: [false, true],
      });
    });

    it("types each plan item by its action, so the agent sees the fields each takes", async () => {
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const schema = tools.find((tool) => tool.name === "segnals_plan_fleet")?.inputSchema as JsonSchema;
      const items = schema.properties?.items as JsonSchema & { maxItems?: number };
      const variants = items.items?.oneOf ?? [];

      expect(schema.required).toEqual(["items"]);
      expect([items.minItems, items.maxItems]).toEqual([1, 500]);
      expect(variants.map((variant) => [variant.properties?.action?.const, variant.required])).toEqual([
        ["create", ["action", "exchange", "connection_id"]],
        ["update", ["action", "bot_id", "config"]],
        ["start", ["action", "bot_id"]],
        ["stop", ["action", "bot_id"]],
        ["delete", ["action", "bot_id"]],
      ]);
      expect(variants[0].properties?.exchange?.enum).toEqual(["mt5", "bybit", "phemex"]);
      expect(variants.some((variant) => "risk_acknowledged" in (variant.properties ?? {}))).toBe(false);
    });
  });

  describe("several accounts", () => {
    it("plans, applies and stops with the named account's key only", async () => {
      answer(200, plan("checked"));
      const mcp = await connect(
        new Accounts([
          { label: "a", client: client(KEY_A) },
          { label: "b", client: client(KEY_B) },
        ]),
      );

      const answers = [
        await call(mcp, "segnals_plan_fleet", { account: "b", items: ITEMS }),
        await call(mcp, "segnals_get_fleet_plan", { account: "b", plan_id: PLAN_ID }),
        await call(mcp, "segnals_apply_fleet_plan", { account: "b", plan_id: PLAN_ID }),
        await call(mcp, "segnals_apply_fleet_plan", { account: "b", plan_id: PLAN_ID, confirm: true }),
        await call(mcp, "segnals_stop_all_fleet", { account: "b" }),
      ];

      for (const result of answers) expect(result.content[0].text).toBe("account: b");
      const auth = requests().map((request) => request.headers.Authorization);
      expect(auth).toHaveLength(5);
      expect(auth.filter((header) => header !== `Bearer ${KEY_B}`)).toEqual([]);
    });

    it("refuses a plan tool called without account, and sends nothing", async () => {
      const mcp = await connect(
        new Accounts([
          { label: "a", client: client(KEY_A) },
          { label: "b", client: client(KEY_B) },
        ]),
      );

      for (const [name, args] of [
        ["segnals_plan_fleet", { items: ITEMS }],
        ["segnals_apply_fleet_plan", { plan_id: PLAN_ID, confirm: true }],
        ["segnals_stop_all_fleet", {}],
      ] as const) {
        const result = await call(mcp, name, args);
        expect(result.isError, name).toBe(true);
        expect(textOf(result), name).toContain('This program holds 2 accounts: "a", "b"');
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("use_fleet_plans from the tools of 0.1.1 (case 4)", () => {
    const USE_FLEET_PLANS = {
      error: "use_fleet_plans",
      message: "A master key reads its fleet and changes it through fleet plans only. Use the fleet tools.",
    };

    it("translates the 403 of every tool that sends a request into a message that names the fleet tools", async () => {
      answer(403, USE_FLEET_PLANS);
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const old = tools.filter((tool) => !SPEC_453_TOOLS.includes(tool.name));
      const sending: string[] = [];

      expect(old).toHaveLength(31);
      for (const tool of old) {
        const before = fetchMock.mock.calls.length;
        const result = await call(mcp, tool.name, argumentsFor(tool.inputSchema as JsonSchema));
        if (fetchMock.mock.calls.length === before) continue;
        sending.push(tool.name);
        const text = textOf(result);
        expect(result.isError, tool.name).toBe(true);
        expect(text, tool.name).toContain("Segnals refused this request (403): A master key reads its fleet");
        expect(text, tool.name).toContain("What to do next: This account's key is a master key.");
        for (const fleetTool of ["segnals_plan_fleet", "segnals_apply_fleet_plan", "segnals_get_fleet_plan", "segnals_stop_all_fleet"]) {
          expect(text, `${tool.name} names ${fleetTool}`).toContain(fleetTool);
        }
        // A master key works: it is not told to make a new one.
        expect(text, tool.name).not.toContain("Generate a new key");
      }

      // Every tool but the two that answer locally sent its request and was walked.
      expect(sending).toHaveLength(29);
      expect(old.map((tool) => tool.name).filter((name) => !sending.includes(name)).sort()).toEqual(LOCAL_TOOLS);
    });

    it("translates it in the previews that read something, too", async () => {
      answer(403, USE_FLEET_PLANS);
      const mcp = await connect();
      const { tools } = await mcp.listTools();
      const previews = tools.filter(
        (tool) => !SPEC_453_TOOLS.includes(tool.name) && "confirm" in ((tool.inputSchema as JsonSchema).properties ?? {}),
      );
      const reading: string[] = [];

      expect(previews).toHaveLength(8);
      for (const tool of previews) {
        const schema = tool.inputSchema as JsonSchema;
        const args: Record<string, unknown> = { ...argumentsFor(schema), confirm: false };
        // segnals_update_bot reads the bot for its preview only when the update has a config.
        if (schema.properties?.config) args.config = { TRADING_PARAMS: { LEVERAGE: 3 } };
        const before = fetchMock.mock.calls.length;
        const result = await call(mcp, tool.name, args);
        if (fetchMock.mock.calls.length === before) continue;
        reading.push(tool.name);
        expect(result.isError, tool.name).toBe(true);
        expect(textOf(result), tool.name).toContain("What to do next: This account's key is a master key.");
      }

      expect(requests().every((request) => request.method === "GET")).toBe(true);
      expect(reading.sort()).toEqual(["segnals_copy_strategy", "segnals_delete_bot", "segnals_update_bot"]);
    });

    it("names the fleet tools for use_fleet_plans only, not for any other 403", async () => {
      answer(403, { error: "protected_bot", message: "This bot is protected." });
      const mcp = await connect();

      const text = textOf(await call(mcp, "segnals_stop_bot", { bot_id: 1 }));
      expect(text).toContain("Segnals refused this request (403): This bot is protected.");
      expect(text).not.toContain("segnals_plan_fleet");

      answer(401, { error: "invalid_api_key", message: "Invalid or revoked API key" });
      expect(textOf(await call(mcp, "segnals_whoami"))).toContain("Generate a new key with the scopes you need");
    });
  });

  describe("server instructions", () => {
    it("name the plan tools in the order of the work: check, show, apply what was approved", () => {
      const check = SERVER_INSTRUCTIONS.indexOf("check the plan with segnals_plan_fleet: it changes nothing");
      const show = SERVER_INSTRUCTIONS.indexOf("Show the person the diff before anything is applied");
      const apply = SERVER_INSTRUCTIONS.indexOf("segnals_apply_fleet_plan with the plan_id they saw");

      expect(check).toBeGreaterThan(0);
      expect(show).toBeGreaterThan(check);
      expect(apply).toBeGreaterThan(show);
      expect(SERVER_INSTRUCTIONS).toContain("segnals_stop_all_fleet stops every bot of the fleet at once");
    });
  });
});
