/**
 * Bots tools — list, get, logs, strategy schema, and config explanation.
 *
 * Tools: segnals_list_bots, segnals_get_bot, segnals_get_bot_logs,
 *        segnals_get_strategy_schema, segnals_explain_config
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { BotSummary, BotDetail } from "../types.js";
import { ok, err } from "./helpers.js";

export function registerBotsTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_list_bots ──
  server.tool(
    "segnals_list_bots",
    `List all trading bots on the user's account with their ID, name, exchange, status, and symbol. Use this to get an overview of all configured bots. Requires scope: read:bots. Example: segnals_list_bots()`,
    {},
    async () => {
      try {
        const data = await client.get<{ bots: BotSummary[] } | BotSummary[]>("/bots/");
        // The API may return { bots: [...] } or just [...]
        const bots = Array.isArray(data) ? data : data.bots;
        const summary = bots.map((b) => ({
          id: b.id,
          name: b.name,
          exchange: b.exchange,
          status: b.status,
          symbol: b.symbol,
          timeframe: b.timeframe,
        }));
        return ok({
          total: summary.length,
          bots: summary,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_bot ──
  server.tool(
    "segnals_get_bot",
    `Get the full configuration and status of a specific bot by its ID. Returns the bot's name, exchange, symbol, status, and complete config object. Use this to inspect a bot's settings in detail. Requires scope: read:bots. Example: segnals_get_bot({ bot_id: 42 })`,
    { bot_id: z.number().int().positive().describe("The ID of the bot to retrieve") },
    async ({ bot_id }) => {
      try {
        const data = await client.get<{ bot: BotDetail } | BotDetail>(`/bots/${bot_id}`);
        const bot = "bot" in data ? data.bot : data;
        return ok({
          id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          status: bot.status,
          symbol: bot.symbol,
          timeframe: bot.timeframe,
          config: bot.config,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_bot_logs ──
  server.tool(
    "segnals_get_bot_logs",
    `Get execution logs for a specific bot. Shows recent trading activity, errors, and system events including cold-start status. Use this to debug bot behavior or check recent activity. Requires scope: read:bots. Example: segnals_get_bot_logs({ bot_id: 42 })`,
    {
      bot_id: z.number().int().positive().describe("The ID of the bot to get logs for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maximum number of log entries (default 50)"),
    },
    async ({ bot_id, limit }) => {
      try {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (limit !== undefined) params.limit = limit;

        const data = await client.get<Record<string, unknown>>(`/bots/${bot_id}/logs`, params);
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_strategy_schema ──
  server.tool(
    "segnals_get_strategy_schema",
    `Get the configuration schema for a bot, showing all available settings, their types, defaults, and valid ranges. Use this to understand what parameters can be configured before creating or updating a bot. Requires scope: read:bots. Example: segnals_get_strategy_schema({ bot_id: 42 })`,
    { bot_id: z.number().int().positive().describe("The ID of the bot to get the schema for") },
    async ({ bot_id }) => {
      try {
        const data = await client.get<{ bot: BotDetail } | BotDetail>(`/bots/${bot_id}`);
        const bot = "bot" in data ? data.bot : data;
        return ok({
          bot_id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          config: bot.config,
          note: "This shows the current configuration. Each field can be modified via segnals_update_bot (requires write:bots scope).",
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_explain_config ──
  server.tool(
    "segnals_explain_config",
    `Analyze and explain a bot's current configuration. Describes what each setting does, flags risky combinations (e.g., Martingale with high multiplier), and suggests improvements. Use this to understand or review a bot's strategy setup. Requires scope: read:bots. Example: segnals_explain_config({ bot_id: 42 })`,
    { bot_id: z.number().int().positive().describe("The ID of the bot to explain") },
    async ({ bot_id }) => {
      try {
        const data = await client.get<{ bot: BotDetail } | BotDetail>(`/bots/${bot_id}`);
        const bot = "bot" in data ? data.bot : data;
        const config = bot.config || {};

        // Build explanation with risk warnings
        const warnings: string[] = [];

        if (config.martingale_enabled || config.martingale) {
          warnings.push(
            "⚠️ MARTINGALE IS ENABLED — this progressively increases position size after losses. " +
              "This can lead to significant drawdowns. Ensure you have adequate capital and stop-loss limits.",
          );
        }

        if (config.leverage && Number(config.leverage) > 10) {
          warnings.push(
            `⚠️ HIGH LEVERAGE (${config.leverage}x) — increases both potential profit and risk of liquidation.`,
          );
        }

        return ok({
          bot_id: bot.id,
          name: bot.name,
          exchange: bot.exchange,
          status: bot.status,
          config,
          warnings: warnings.length > 0 ? warnings : ["✅ No high-risk settings detected."],
          note: "This is a software analysis of the configuration. It is not financial advice. Always review settings carefully before running a bot with real funds.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
