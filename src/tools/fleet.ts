/**
 * Fleet reads (SPEC 453 §3.9) — the settings catalog, the fleet, and its report.
 *
 * Tools: segnals_get_settings_catalog, segnals_get_fleet, segnals_fleet_report
 *
 * None of them changes anything. The catalog answers any valid key. The fleet and its report
 * answer a master key only (the account holder creates it in Settings → Bot manager), and only
 * while the server's bot manager is switched on. Each error says what to do next.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { SegnalsApiError } from "../errors.js";
import { ok, type ToolResult } from "./helpers.js";

/** The engines the API serves a catalog for (`GET /settings/catalog?engine=`). */
export const ENGINES = ["mt5", "bybit", "phemex", "grid"] as const;
export type Engine = (typeof ENGINES)[number];

/** The report's periods (`GET /fleet/report?period=`), and the API's own default. */
export const REPORT_PERIODS = ["24h", "7d", "30d"] as const;
const DEFAULT_REPORT_PERIOD = "7d";

/** What every fleet read is: it reads, and changes nothing. */
const READS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

const MASTER_KEY_HINT =
  "Only a master key reads the fleet. The account holder creates one in Settings → Bot manager " +
  "(VIP accounts) and puts it in this program's accounts file; a key from Settings → API Keys never holds manage:fleet.";

/**
 * What to do next, for the API's refusals of a fleet read. Keyed by the API's error code.
 */
const NEXT_STEP = new Map<string, string>(Object.entries({
  fleet_manager_off:
    "The bot manager is switched off on this server, and a master key works only while it is on. " +
    "Tell the person; nothing on this account can be read or planned until it is switched on.",
  fleet_disabled:
    "This master key's fleet is disabled. The account holder can enable it in Settings → Bot manager. " +
    "Tell the person; do not retry until they have.",
  key_not_accepted:
    "Segnals issued this master key and the account holder has not accepted it yet. " +
    "They accept or decline it in Settings → Bot manager.",
  master_key_only: `This account's key is not a master key. ${MASTER_KEY_HINT} ` +
    "Until then, segnals_list_bots shows the bots this key can read.",
  insufficient_scope: MASTER_KEY_HINT,
  use_fleet_plans:
    "A master key reads only its own fleet. Use segnals_get_fleet, segnals_fleet_report and segnals_get_settings_catalog.",
  unknown_engine: `Use one of the engines ${ENGINES.join(", ")}.`,
  engine_not_served:
    "This server does not serve that engine's catalog yet. Read another engine, or tell the person the server is older than the catalog.",
  bad_period: `Use one of the periods ${REPORT_PERIODS.join(", ")}.`,
}));

/** The API answered 404 on a fleet route: the routes are hidden while the bot manager is off. */
const FLEET_ROUTES_HIDDEN =
  "The fleet routes answer 404 while the bot manager is off on this server (FLEET_MANAGER_ENABLED), " +
  "or the server predates them. Tell the person; segnals_list_accounts shows which accounts can read a fleet.";

/**
 * A fleet read's error, with the next step. The message is the API's own (never the key),
 * followed by what to do about it.
 */
export function fleetError(error: unknown, notFound: string = FLEET_ROUTES_HIDDEN): ToolResult {
  let text: string;
  let next: string | undefined;
  if (error instanceof SegnalsApiError) {
    text = error.message;
    next = NEXT_STEP.get(error.apiError ?? error.errorCode);
    if (next === undefined && error.statusCode === 404) next = notFound;
    if (next === undefined && error.statusCode === 401) {
      next = "Ask the person for a new key for this account and put it in the accounts file; this one is invalid, expired or revoked.";
    }
  } else {
    text = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
  return {
    content: [{ type: "text" as const, text: next === undefined ? text : `${text}\n\nWhat to do next: ${next}` }],
    isError: true,
  };
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
          return fleetError(
            new Error(
              "The API's answer holds no settings list. The server may predate the settings catalog (SPEC 453); tell the person.",
            ),
          );
        }
        return ok(answer);
      } catch (error) {
        return fleetError(
          error,
          "This server has no settings catalog route; it predates SPEC 453. Tell the person, and do not guess setting names.",
        );
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
        return fleetError(error);
      }
    },
  );
}
