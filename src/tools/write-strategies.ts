/**
 * Write tools for strategies and indicator filters.
 *
 * Tools: segnals_create_strategy ✋, segnals_set_indicator_filter
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";
import { SAFETY_DISCLAIMER } from "./meta.js";

/**
 * Detect risky combos in strategy config — shared with write-bots.
 */
function detectRiskyConfig(config: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  const martingale = config.MARTINGALE_ENABLED ?? config.martingale_enabled;
  const leverage = Number(config.LEVERAGE ?? config.leverage ?? 1);

  if (martingale && leverage > 10) {
    warnings.push(
      "⚠️ HIGH RISK: Martingale + leverage > 10x can amplify losses rapidly.",
    );
  }
  if (martingale) {
    warnings.push(
      "⚠️ Martingale mode increases position sizes after losses.",
    );
  }
  if (leverage > 20) {
    warnings.push(`⚠️ Very high leverage (${leverage}x).`);
  }

  const sl = Number(config.STOP_LOSS_PERCENT ?? config.stop_loss_percent ?? 0);
  if (sl === 0) {
    warnings.push("⚠️ No stop-loss configured.");
  }

  return warnings;
}

export function registerWriteStrategyTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_create_strategy ✋ ──
  server.tool(
    "segnals_create_strategy",
    `Create a fully configured trading strategy (bot + config). Requires scope: write:strategies.

TWO-STEP CONFIRMATION: Call without confirm to preview and validate. Call with confirm: true to create.
This orchestrates: create bot → apply full config. The bot starts in 'stopped' state.
IMPORTANT: Never include exchange API keys/secrets in the config.`,
    {
      exchange: z.enum(["bybit", "phemex", "mt5"]).describe("Exchange for the strategy"),
      name: z.string().min(1).max(100).describe("Strategy name"),
      config: z.record(z.unknown()).describe("Full strategy configuration"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ exchange, name, config, confirm }) => {
      try {
        // Always check for forbidden keys
        const forbiddenKeys = ["API_KEY", "API_SECRET", "api_key", "api_secret", "MT5_PASSWORD"];
        const rejected = Object.keys(config).filter(k => forbiddenKeys.includes(k));
        if (rejected.length > 0) {
          return ok({
            action: "create_strategy",
            preview: "REJECTED: Config contains exchange credentials.",
            rejected_keys: rejected,
            instruction: "Never pass exchange API keys or MT5 passwords via MCP. " +
              "Enter credentials at segnals.com → Settings → Connections.",
          });
        }

        const warnings = detectRiskyConfig(config);

        if (!confirm) {
          return ok({
            action: "create_strategy",
            preview: `Will create strategy '${name}' on ${exchange.toUpperCase()} ` +
              `with ${Object.keys(config).length} config parameters. ` +
              "The bot will start in 'stopped' state and will NOT begin trading automatically.",
            exchange,
            name,
            config_keys: Object.keys(config),
            warnings,
            disclaimer: SAFETY_DISCLAIMER,
            instruction: "To proceed, call segnals_create_strategy again with confirm: true",
          });
        }

        // Step 1: Create bot
        const createResult = await client.post<{ msg: string; bot_id: number }>(
          "/bots/create",
          { exchange, client: "mcp" },
        );

        // Step 2: Apply full config
        try {
          await client.put<{ msg: string }>(
            `/bots/${createResult.bot_id}`,
            { name, config, client: "mcp" },
          );
        } catch (updateError) {
          // Report partial success: bot created but config update failed
          return ok({
            action: "create_strategy",
            executed: true,
            partial_failure: true,
            bot_id: createResult.bot_id,
            message: `Bot #${createResult.bot_id} was created on ${exchange}, ` +
              "but the config update failed. The bot exists with default settings.",
            update_error: updateError instanceof Error ? updateError.message : String(updateError),
            next_steps: [
              `Try updating manually: segnals_update_bot({ bot_id: ${createResult.bot_id}, name: "${name}", config: { ... } })`,
            ],
          });
        }

        return ok({
          action: "create_strategy",
          executed: true,
          bot_id: createResult.bot_id,
          message: `Strategy '${name}' created successfully on ${exchange.toUpperCase()}.`,
          exchange,
          status: "stopped",
          warnings,
          disclaimer: SAFETY_DISCLAIMER,
          next_steps: [
            `Start the bot: segnals_start_bot({ bot_id: ${createResult.bot_id} })`,
            `View config: segnals_get_bot({ bot_id: ${createResult.bot_id} })`,
          ],
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_set_indicator_filter (no confirmation — non-destructive config tweak) ──
  server.tool(
    "segnals_set_indicator_filter",
    `Configure an indicator-based regime filter (ADX, RSI, EMA, ATR) on a bot. Requires scope: write:bots.

This is a non-destructive config update — no confirmation required. The filter is applied to the bot's config and takes effect on next trade evaluation.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to configure"),
      filter_type: z.enum(["adx", "rsi", "ema", "atr"]).describe("Indicator filter type"),
      enabled: z.boolean().describe("Enable or disable the filter"),
      params: z.record(z.unknown()).optional().describe("Filter parameters (e.g., period, threshold)"),
    },
    async ({ bot_id, filter_type, enabled, params }) => {
      try {
        // Build the config update for the specific filter
        const filterKey = `FILTER_${filter_type.toUpperCase()}`;
        const config: Record<string, unknown> = {
          [`${filterKey}_ENABLED`]: enabled,
        };

        if (params) {
          for (const [key, value] of Object.entries(params)) {
            config[`${filterKey}_${key.toUpperCase()}`] = value;
          }
        }

        const result = await client.put<{ msg: string }>(
          `/bots/${bot_id}`,
          { config, client: "mcp" },
        );

        return ok({
          action: "set_indicator_filter",
          executed: true,
          bot_id,
          filter_type,
          enabled,
          message: result.msg,
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
