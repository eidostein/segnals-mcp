/**
 * Fleet reads (SPEC 453 §3.9) — the settings catalog, the fleet, and its report.
 *
 * Tools: segnals_get_settings_catalog, segnals_get_fleet, segnals_fleet_report
 *
 * None of them changes anything. The catalog answers any valid key. The fleet and its report
 * answer a master key only (the account holder creates it in Settings → Bot manager), and only
 * while the server's bot manager is switched on. Each error ends with what to do next.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ScopeError, SegnalsApiError } from "../errors.js";
import { ok, USE_FLEET_TOOLS, type ToolResult } from "./helpers.js";

/** The engines the API serves a catalog for (`GET /settings/catalog?engine=`). */
export const ENGINES = ["mt5", "bybit", "phemex", "grid"] as const;
export type Engine = (typeof ENGINES)[number];

/** The report's periods (`GET /fleet/report?period=`), and the API's own default. */
export const REPORT_PERIODS = ["24h", "7d", "30d"] as const;
const DEFAULT_REPORT_PERIOD = "7d";

/** What every fleet read is: it reads, and changes nothing. */
const READS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

const MASTER_KEY_HINT =
  "Only a master key reads the fleet and its report. The account holder creates one in Settings → Bot manager " +
  "(VIP accounts) and gives it to this program in its accounts file; a key from Settings → API Keys never holds manage:fleet.";

const NEW_KEY =
  "Ask the person for a new key for this account, to replace this one in the program's configuration: " +
  "this one is invalid, expired or revoked.";

/**
 * What to do next, for the API's refusals of a fleet read. Keyed by the API's error code
 * (the answer's `error`), else by the client's own code for the status.
 */
const NEXT_STEP = new Map<string, string>(
  Object.entries({
    fleet_manager_off:
      "The bot manager is switched off on this server, and a master key works only while it is on. " +
      "Tell the person; nothing on this account can be read or planned until it is switched on.",
    fleet_disabled:
      "This master key's fleet is disabled. The account holder can enable it in Settings → Bot manager. " +
      "Tell the person; do not retry until they have.",
    key_not_accepted:
      "Segnals issued this master key and the account holder has not accepted it yet. " +
      "They accept or decline it in Settings → Bot manager.",
    master_key_only:
      `This account's key is not a master key. ${MASTER_KEY_HINT} ` +
      "Until then, segnals_list_bots shows the bots this key can read.",
    insufficient_scope: MASTER_KEY_HINT,
    use_fleet_plans: USE_FLEET_TOOLS,
    unknown_engine: `Use one of the engines ${ENGINES.join(", ")}.`,
    engine_not_served:
      "This server does not serve that engine's catalog yet. Read another engine, or tell the person the server is older than the catalog.",
    bad_period: `Use one of the periods ${REPORT_PERIODS.join(", ")}.`,
    invalid_api_key: NEW_KEY,
    expired_api_key: NEW_KEY,
    ip_not_allowed:
      "The key is valid, but its IP allow-list does not include the machine this program runs on. " +
      "The account holder can change the key's allow-list; do not ask for a new key.",
    rate_limit_exceeded: "Each key may send 120 requests a minute. Wait as long as the message says, then retry once.",
    server_error: "Retry once in a minute. If it fails again, tell the person the Segnals API is failing.",
    network_error: "Check that SEGNALS_API_BASE names the right server and the network is up, then retry once.",
  }),
);

/** Any other refusal: the API's own message says what it refused. */
const TELL_THE_PERSON = "Tell the person what Segnals answered; do not send the same call again unchanged.";

/**
 * A 404 from GET /fleet, to a key. While the bot manager is off a key never gets one: a master key is
 * refused `fleet_manager_off` and a manual key `insufficient_scope` (no manual key holds manage:fleet).
 * So the route is missing.
 */
const FLEET_ROUTES_MISSING =
  "This server has no fleet routes: it predates the bot manager (SPEC 453). Tell the person; " +
  "nothing on this account can be read as a fleet here.";

/**
 * A 404 from GET /fleet/report, to a key. Unlike GET /fleet, a manual key holding read:stats passes the
 * scope check and gets the 404 of a switched-off bot manager; with it on, it would get `master_key_only`.
 */
const REPORT_NOT_FOUND =
  "The fleet report answered 404: the server's bot manager is switched off, or the server predates it (SPEC 453). " +
  "Either way this key reads no fleet report here; only a master key does, while the bot manager is on. Tell the person.";

/** The scopes a ScopeError names, without the advice to add one to the key: a manual key never holds manage:fleet. */
function scopeText(required: string | string[], what: string): string {
  const scopes = (Array.isArray(required) ? required : [required]).map((scope) => `\`${scope}\``);
  return `Segnals refused this request (403): this key lacks the scope ${scopes.join(" or ")} that this ${what} needs.`;
}

/** An error answer: what happened, then what to do next. */
export function refusal(text: string, next: string): ToolResult {
  return { content: [{ type: "text" as const, text: `${text}\n\nWhat to do next: ${next}` }], isError: true };
}

/** How a fleet tool's errors are read, beyond the codes every fleet tool shares. */
export interface FleetErrorOptions {
  /** What a 404 the API gave no other meaning means for this tool. */
  notFound?: string;
  /** Next steps of this tool's own, keyed by the API's error code; they come before the shared ones. */
  more?: ReadonlyMap<string, string>;
  /** What a scope refusal calls the request: "read" (the default) or "request". */
  what?: string;
}

/**
 * A fleet tool's error, with the next step. The message is the API's own (never the key),
 * followed by what to do about it.
 */
export function fleetError(error: unknown, options: FleetErrorOptions = {}): ToolResult {
  const { notFound = FLEET_ROUTES_MISSING, more, what = "read" } = options;
  if (!(error instanceof SegnalsApiError)) {
    return refusal(`Error: ${error instanceof Error ? error.message : String(error)}`, TELL_THE_PERSON);
  }
  const text = error instanceof ScopeError ? scopeText(error.requiredScope, what) : error.message;
  const code = error.apiError ?? "";
  const next =
    more?.get(code) ??
    NEXT_STEP.get(code) ??
    NEXT_STEP.get(error.errorCode) ??
    (error.statusCode === 404 ? notFound : error.statusCode === 401 ? NEW_KEY : TELL_THE_PERSON);
  return refusal(text, next);
}

interface CatalogSetting {
  path?: unknown;
  [field: string]: unknown;
}

interface Catalog {
  engine?: unknown;
  version?: unknown;
  generated_from?: unknown;
  settings?: unknown;
}

/** True when `path` is `wanted` or a setting inside the block `wanted` (`MARTINGALE` → `MARTINGALE.ENABLED`). */
function within(path: string, wanted: string): boolean {
  return path === wanted || path.startsWith(`${wanted}.`);
}

/** The catalog as the tool answers it: the API's fields, a count, and the settings asked for. */
export function catalogAnswer(catalog: Catalog, paths?: string[]): Record<string, unknown> | undefined {
  if (!Array.isArray(catalog.settings)) return undefined;
  const settings = catalog.settings as CatalogSetting[];
  const head = {
    engine: catalog.engine,
    version: catalog.version,
    generated_from: catalog.generated_from,
    count: settings.length,
  };
  if (paths === undefined || paths.length === 0) {
    return { ...head, settings };
  }
  const chosen = settings.filter(
    (setting) => typeof setting.path === "string" && paths.some((wanted) => within(setting.path as string, wanted)),
  );
  const notFound = paths.filter(
    (wanted) => !settings.some((setting) => typeof setting.path === "string" && within(setting.path, wanted)),
  );
  return { ...head, returned: chosen.length, not_found: notFound, settings: chosen };
}

export function registerFleetTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_settings_catalog ──
  server.tool(
    "segnals_get_settings_catalog",
    `Every setting of one engine (mt5, bybit, phemex or grid): its path, type, unit, range, default, meaning in English and German (meaning_en, meaning_de), the settings it depends on (depends_on), whether it changes how much is risked (money), and whether a key may change it (key_may_change). Read this FIRST, before you plan or change any bot setting: use only the paths it lists, inside their range, and never one whose key_may_change is false. count is the number of settings. version is a hash of the catalog: when it equals the version you read before, nothing changed and you need not read it again. Narrow the answer with paths, each a full path (TRADING_PARAMS.LEVERAGE) or a block (MARTINGALE, every setting under it); not_found lists those that matched nothing. The resource segnals://settings/{engine} holds the same catalog. Requires: any valid key. Example: segnals_get_settings_catalog({ engine: "bybit", paths: ["TRADING_PARAMS", "MARTINGALE.ENABLED"] })`,
    {
      engine: z
        .enum(ENGINES)
        .describe('The engine: "mt5", "bybit", "phemex" or "grid" (the MT5 grid strategy)'),
      paths: z
        .array(z.string().min(1).max(200))
        .min(1)
        .max(200)
        .optional()
        .describe(
          "Only these settings: a full path (TRADING_PARAMS.LEVERAGE) or a block (MARTINGALE). Leave it out for every setting.",
        ),
    },
    READS,
    async ({ engine, paths }): Promise<ToolResult> => {
      try {
        const catalog = await client.get<Catalog>("/settings/catalog", { engine });
        const answer = catalogAnswer(catalog, paths);
        if (answer === undefined) {
          return refusal(
            "The API's answer holds no settings list.",
            "The server may predate the settings catalog (SPEC 453). Tell the person, and do not guess setting names.",
          );
        }
        return ok(answer);
      } catch (error) {
        return fleetError(error, {
          notFound:
            "This server has no settings catalog route; it predates SPEC 453. Tell the person, and do not guess setting names.",
        });
      }
    },
  );

  // ── segnals_get_fleet ──
  server.tool(
    "segnals_get_fleet",
    `This account's fleet, as its master key sees it. account: the tier, the bot limit and how many bots the account has. fleets (one, the key's own): its id; status (active; stopped_all, which still reads but starts nothing; disabled); its policy, the caps every plan must fit (max_bots, max_risk_per_bot_pct, max_total_risk_pct, the USD caps, allowed_connection_ids, allowed_exchanges, allow_real_money, confirm_every_start, max_items_per_plan, max_new_running_per_plan); bot_ids and how many run; and per allowed connection its exchange, whether it is demo, its currency and equity. Read it before you plan anything for this account, together with segnals_get_settings_catalog. It holds no email, username or billing. Requires: a master key (manage:fleet), while the server's bot manager is on. Example: segnals_get_fleet()`,
    {},
    READS,
    async (): Promise<ToolResult> => {
      try {
        return ok(await client.get<unknown>("/fleet"));
      } catch (error) {
        return fleetError(error);
      }
    },
  );

  // ── segnals_fleet_report ──
  server.tool(
    "segnals_fleet_report",
    `The fleet's performance for a period ("24h", "7d" by default, "30d") and the period of the same length before it (previous). KPIs per bot, for the fleet, and in totals over every fleet the key reads: net_pnl and net_pnl_pct_of_capital, return_pct, win_rate_pct, profit_factor, expectancy, trades, max_drawdown_pct, current_drawdown_pct, margin_used_pct. Each bot also has its exchange, symbols, whether it is demo, its status, and its health: seconds since its last sign of life (last_sign_of_life_s, with its source) and errors_24h. A KPI that is not measured is null, never 0: report it as "not measured", not as zero. With fewer than 20 trades, the win rate, profit factor and expectancy say little; say so. Fleet amounts are in the account's currency (account_currency); totals are in USD. Use it to tell the person how the fleet is doing, and before planning a change to it. Requires: a master key (read:stats), while the server's bot manager is on. Example: segnals_fleet_report({ period: "30d" })`,
    {
      period: z
        .enum(REPORT_PERIODS)
        .optional()
        .describe('The period: "24h", "7d" (default) or "30d"'),
    },
    READS,
    async ({ period }): Promise<ToolResult> => {
      try {
        return ok(await client.get<unknown>("/fleet/report", { period: period ?? DEFAULT_REPORT_PERIOD }));
      } catch (error) {
        return fleetError(error, { notFound: REPORT_NOT_FOUND });
      }
    },
  );
}
