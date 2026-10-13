/**
 * Stats tools — dashboard, PnL, bot performance, and trades.
 *
 * Tools: segnals_get_dashboard, segnals_get_pnl_summary, segnals_get_bot_performance, segnals_get_trades
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { DashboardData, BotPerformance } from "../types.js";
import { ok, err } from "./helpers.js";

const TIMEFRAMES = ["24h", "7d", "30d", "all"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

/** Sent when the caller names no period, so the answer can say which period it covers. */
const DEFAULT_TIMEFRAME: Timeframe = "7d";

/**
 * A date the API parses on every Python version: YYYY-MM-DD, optionally followed by a
 * time and a zone. The API answers an unparseable date with the whole history and
 * status 200, so a bad value is stopped here.
 */
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{3}(?:\d{3})?)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/;

function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const isoDate = z.string().refine(isIsoDate, {
  message: "Use ISO 8601: 2026-10-01 or 2026-10-01T00:00:00Z",
});

const PERIOD_HELP =
  `Period: timeframe "24h", "7d" (default), "30d" or "all"; or start_date and end_date together (ISO 8601), which take precedence over timeframe. A bare date means 00:00 of that day, so an end_date of 2026-10-31 leaves the 31st out: pass 2026-11-01 to include it.`;

const periodShape = {
  timeframe: z
    .enum(TIMEFRAMES)
    .optional()
    .describe('Period to report: "24h", "7d" (default), "30d" or "all"'),
  start_date: isoDate
    .optional()
    .describe("Start of a custom period, ISO 8601 (e.g. 2026-10-01). Requires end_date."),
  end_date: isoDate
    .optional()
    .describe("End of a custom period, ISO 8601 (e.g. 2026-11-01). Requires start_date."),
};

interface PeriodArgs {
  timeframe?: Timeframe;
  start_date?: string;
  end_date?: string;
}

/**
 * Query parameters for GET /bots/dashboard. The API ignores a single bound and falls
 * back to its 7-day default without saying so, hence the refusal here.
 */
function periodParams({ timeframe, start_date, end_date }: PeriodArgs): Record<string, string> {
  if ((start_date === undefined) !== (end_date === undefined)) {
    throw new Error("start_date and end_date must be given together.");
  }
  if (start_date !== undefined && end_date !== undefined) {
    for (const value of [start_date, end_date]) {
      if (!isIsoDate(value)) {
        throw new Error(`'${value}' is not a date. Use ISO 8601: 2026-10-01 or 2026-10-01T00:00:00Z.`);
      }
    }
    return { ...(timeframe ? { timeframe } : {}), start_date, end_date };
  }
  return { timeframe: timeframe ?? DEFAULT_TIMEFRAME };
}

/** The period an answer covers, in the caller's own terms. */
function periodOf(params: Record<string, string>): Record<string, string> {
  return params.start_date
    ? { start_date: params.start_date, end_date: params.end_date }
    : { timeframe: params.timeframe };
}

export function registerStatsTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_dashboard ──
  server.tool(
    "segnals_get_dashboard",
    `Get the trading dashboard overview for a period: total PnL, win rate and trade count of that period, the equity curve, plus the current bot counts and the 10 latest trades (those two are not limited to the period). ${PERIOD_HELP} Requires scope: read:stats. Example: segnals_get_dashboard({ timeframe: "30d" })`,
    periodShape,
    async (args: PeriodArgs) => {
      try {
        const params = periodParams(args);
        const data = await client.get<DashboardData>("/bots/dashboard", params);
        return ok({ period: periodOf(params), ...data });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_pnl_summary ──
  server.tool(
    "segnals_get_pnl_summary",
    `Get the PnL (profit and loss) summary for a period: total PnL, win rate and trade count of that period, plus the current bot counts. ${PERIOD_HELP} Requires scope: read:stats. Example: segnals_get_pnl_summary({ timeframe: "30d" })`,
    periodShape,
    async (args: PeriodArgs) => {
      try {
        const params = periodParams(args);
        const data = await client.get<DashboardData>("/bots/dashboard", params);
        return ok({
          period: periodOf(params),
          total_pnl: data.total_pnl,
          win_rate: data.win_rate,
          total_trades: data.total_trades,
          active_bots: data.active_bots,
          total_bots: data.total_bots,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_bot_performance ──
  server.tool(
    "segnals_get_bot_performance",
    `Get detailed performance metrics for a specific bot: net PnL, win rate, total trades, drawdown, and more. Use this to analyze how well a particular bot is performing. Requires scope: read:stats. Example: segnals_get_bot_performance({ bot_id: 42 })`,
    { bot_id: z.number().int().positive().describe("The ID of the bot to get performance for") },
    async ({ bot_id }) => {
      try {
        const data = await client.get<BotPerformance>(`/bots/${bot_id}/performance`);
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_trades ──
  server.tool(
    "segnals_get_trades",
    `Get recent trade history across all bots, with optional filtering by bot ID, symbol, or date range. Use this to review individual trades. Requires scope: read:stats. Example: segnals_get_trades({ limit: 20 })`,
    {
      bot_id: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Filter trades to a specific bot ID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Maximum number of trades to return (default 50, max 100)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Offset for pagination"),
    },
    async ({ bot_id, limit, offset }) => {
      try {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (bot_id !== undefined) params.bot_id = bot_id;
        if (limit !== undefined) params.limit = limit;
        if (offset !== undefined) params.offset = offset;

        const data = await client.get<Record<string, unknown>>("/bots/trades", params);
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );
}
