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

export function registerStatsTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_dashboard ──
  server.tool(
    "segnals_get_dashboard",
    `Get the trading dashboard overview: total PnL, win rate, active bots count, equity curve, and summary stats. Use this for a high-level view of trading performance. Requires scope: read:stats. Example: segnals_get_dashboard()`,
    {},
    async () => {
      try {
        const data = await client.get<DashboardData>("/bots/dashboard");
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_pnl_summary ──
  server.tool(
    "segnals_get_pnl_summary",
    `Get aggregated PnL (profit and loss) breakdown from the dashboard data. Use this to analyze profitability over time. Requires scope: read:stats. Example: segnals_get_pnl_summary()`,
    {},
    async () => {
      try {
        const data = await client.get<DashboardData>("/bots/dashboard");
        return ok({
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
