/**
 * Write/control tools for bots.
 *
 * Tools: segnals_create_bot ✋, segnals_update_bot ✋, segnals_start_bot ✋,
 *        segnals_stop_bot, segnals_restart_bot ✋, segnals_delete_bot ✋
 *
 * Every ✋ tool uses the two-step confirmation pattern:
 *   1. Default call returns a preview of what will happen (no mutation)
 *   2. Calling with confirm: true executes the action
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";
import { SAFETY_DISCLAIMER } from "./meta.js";

/**
 * Detect risky configuration combos and return human-readable warnings.
 */
function detectRiskyConfig(config: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  const martingale = config.MARTINGALE_ENABLED ?? config.martingale_enabled;
  const leverage = Number(config.LEVERAGE ?? config.leverage ?? 1);

  if (martingale && leverage > 10) {
    warnings.push(
      "⚠️ HIGH RISK: Martingale is enabled with leverage > 10x. " +
        "This combination can amplify losses rapidly in volatile markets.",
    );
  }

  if (martingale) {
    warnings.push(
      "⚠️ Martingale mode is enabled. This progressively increases position " +
        "sizes after losses, which can lead to significant drawdowns.",
    );
  }

  if (leverage > 20) {
    warnings.push(
      `⚠️ Very high leverage (${leverage}x). Consider reducing leverage to manage risk.`,
    );
  }

  const slPercent = Number(config.STOP_LOSS_PERCENT ?? config.stop_loss_percent ?? 0);
  if (slPercent === 0) {
    warnings.push(
      "⚠️ No stop-loss configured. Your positions have no downside protection.",
    );
  }

  return warnings;
}

export function registerWriteBotTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_create_bot ✋ ──
  server.tool(
    "segnals_create_bot",
    `Create a new trading bot on Segnals. Requires scope: write:bots.

TWO-STEP CONFIRMATION: Call without confirm (or confirm: false) to preview. Call with confirm: true to execute.
The new bot starts in 'stopped' state — it will NOT start trading automatically.
IMPORTANT: Never ask for or accept exchange API keys/secrets — users enter those in the Segnals dashboard (Settings → Connections).`,
    {
      exchange: z.enum(["bybit", "phemex", "mt5"]).describe("Exchange to create the bot for"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ exchange, confirm }) => {
      try {
        if (!confirm) {
          return ok({
            action: "create_bot",
            preview: `Will create a new trading bot on ${exchange.toUpperCase()}. ` +
              `The bot will start in 'stopped' state and will NOT begin trading automatically. ` +
              `You can configure it with segnals_update_bot after creation.`,
            disclaimer: SAFETY_DISCLAIMER,
            warnings: [],
            instruction: "To proceed, call segnals_create_bot again with confirm: true",
          });
        }

        const result = await client.post<{ msg: string; bot_id: number }>(
          "/bots/create",
          { exchange, client: "mcp" },
        );

        return ok({
          action: "create_bot",
          executed: true,
          bot_id: result.bot_id,
          message: result.msg,
          exchange,
          status: "stopped",
          disclaimer: SAFETY_DISCLAIMER,
          next_steps: [
            `Configure the bot: segnals_update_bot({ bot_id: ${result.bot_id}, config: { ... } })`,
            `Start the bot: segnals_start_bot({ bot_id: ${result.bot_id} })`,
          ],
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_update_bot ✋ ──
  server.tool(
    "segnals_update_bot",
    `Update a bot's configuration. Requires scope: write:bots.

TWO-STEP CONFIRMATION: Call without confirm to preview changes and see risk warnings. Call with confirm: true to apply.
IMPORTANT: Never include exchange API keys/secrets in the config — users enter those in the dashboard.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to update"),
      name: z.string().optional().describe("New bot name"),
      config: z.record(z.unknown()).optional().describe("Configuration key-value pairs to update"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ bot_id, name, config, confirm }) => {
      try {
        if (!confirm) {
          // Preview: show what will change and flag risky combos
          const warnings = config ? detectRiskyConfig(config) : [];

          // Check for forbidden keys in config
          const forbiddenKeys = ["API_KEY", "API_SECRET", "api_key", "api_secret", "MT5_PASSWORD"];
          const rejected = Object.keys(config || {}).filter(k => forbiddenKeys.includes(k));
          if (rejected.length > 0) {
            return ok({
              action: "update_bot",
              preview: "REJECTED: Config contains exchange credentials.",
              rejected_keys: rejected,
              instruction: "Never pass exchange API keys or MT5 passwords via MCP. " +
                "Enter credentials at segnals.com → Settings → Connections.",
            });
          }

          return ok({
            action: "update_bot",
            preview: `Will update bot #${bot_id}` +
              (name ? ` (rename to '${name}')` : "") +
              (config ? ` with ${Object.keys(config).length} config changes` : "") +
              ".",
            changes: {
              ...(name ? { name } : {}),
              ...(config ? { config_keys: Object.keys(config) } : {}),
            },
            warnings,
            instruction: "To proceed, call segnals_update_bot again with confirm: true",
          });
        }

        const body: Record<string, unknown> = { client: "mcp" };
        if (name) body.name = name;
        if (config) body.config = config;

        const result = await client.put<{ msg: string }>(
          `/bots/${bot_id}`,
          body,
        );

        return ok({
          action: "update_bot",
          executed: true,
          bot_id,
          message: result.msg,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_start_bot ✋ ──
  server.tool(
    "segnals_start_bot",
    `Start a trading bot. Requires scope: control:bots.

TWO-STEP CONFIRMATION: Call without confirm to preview. Call with confirm: true to start.
COLD-START NOTE: Starting a bot takes a few minutes. The status will show 'starting' → 'warming_up' → 'running'. This is normal behavior.
IMPORTANT: The bot must have exchange credentials configured in the dashboard before starting.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to start"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ bot_id, confirm }) => {
      try {
        if (!confirm) {
          return ok({
            action: "start_bot",
            preview: `Will start bot #${bot_id}. ` +
              "IMPORTANT: Starting can take a few minutes. The bot status will progress through " +
              "'starting' → 'warming_up' → 'running'. This cold-start behavior is normal. " +
              "Make sure the bot has exchange credentials configured in the dashboard " +
              "(Settings → Connections) before starting.",
            disclaimer: SAFETY_DISCLAIMER,
            warnings: [],
            instruction: "To proceed, call segnals_start_bot again with confirm: true",
          });
        }

        const result = await client.post<{ status: string; msg?: string }>(
          `/bots/${bot_id}/control`,
          { action: "start", client: "mcp" },
        );

        return ok({
          action: "start_bot",
          executed: true,
          bot_id,
          status: result.status,
          message: result.msg || `Bot #${bot_id} is now starting.`,
          disclaimer: SAFETY_DISCLAIMER,
          note: "The bot will progress: 'starting' → 'warming_up' → 'running'. " +
            "Use segnals_get_bot to check status.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_stop_bot (no confirmation needed — safe action) ──
  server.tool(
    "segnals_stop_bot",
    `Stop a running trading bot. Requires scope: control:bots.

This is a safe action — no confirmation required. The bot will stop trading but its configuration is preserved.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to stop"),
    },
    async ({ bot_id }) => {
      try {
        const result = await client.post<{ status: string; msg?: string }>(
          `/bots/${bot_id}/control`,
          { action: "stop", client: "mcp" },
        );

        return ok({
          action: "stop_bot",
          executed: true,
          bot_id,
          status: result.status,
          message: result.msg || `Bot #${bot_id} has been stopped.`,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_restart_bot ✋ ──
  server.tool(
    "segnals_restart_bot",
    `Restart a trading bot. Requires scope: control:bots.

TWO-STEP CONFIRMATION: Call without confirm to preview. Call with confirm: true to restart.
NOTE: Restarting resets the bot's loss streaks and goes through the cold-start cycle.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to restart"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ bot_id, confirm }) => {
      try {
        if (!confirm) {
          return ok({
            action: "restart_bot",
            preview: `Will restart bot #${bot_id}. ` +
              "This stops the bot, resets loss streaks, and starts it again. " +
              "The bot will go through the cold-start cycle " +
              "('stopping' → 'stopped' → 'starting' → 'warming_up' → 'running').",
            warnings: ["Loss streaks will be reset to 0."],
            instruction: "To proceed, call segnals_restart_bot again with confirm: true",
          });
        }

        const result = await client.post<{ status: string; msg?: string }>(
          `/bots/${bot_id}/control`,
          { action: "restart", client: "mcp" },
        );

        return ok({
          action: "restart_bot",
          executed: true,
          bot_id,
          status: result.status,
          message: result.msg || `Bot #${bot_id} is restarting.`,
          note: "The bot will go through the cold-start cycle. Check status with segnals_get_bot.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_delete_bot ✋ ──
  server.tool(
    "segnals_delete_bot",
    `Permanently delete a trading bot. Requires scope: write:bots.

TWO-STEP CONFIRMATION: Call without confirm to preview. Call with confirm: true to delete.
WARNING: This action is PERMANENT and cannot be undone. The bot must be stopped first.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to delete"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ bot_id, confirm }) => {
      try {
        if (!confirm) {
          // Fetch bot info to show in preview
          let botName = `Bot #${bot_id}`;
          try {
            const botInfo = await client.get<{ bot: { name: string; exchange: string; status: string } }>(
              `/bots/${bot_id}`,
            );
            botName = `'${botInfo.bot.name}' (${botInfo.bot.exchange}, ${botInfo.bot.status})`;
          } catch {
            // If we can't fetch info, still show the preview with just the ID
          }

          return ok({
            action: "delete_bot",
            preview: `Will PERMANENTLY delete ${botName}. ` +
              "This cannot be undone. All configuration, logs, and trade history " +
              "associated with this bot will be removed. " +
              "The bot must be stopped before deletion.",
            warnings: ["⚠️ THIS ACTION IS PERMANENT AND CANNOT BE UNDONE."],
            instruction: "To proceed, call segnals_delete_bot again with confirm: true",
          });
        }

        const result = await client.del<{ msg: string }>(`/bots/${bot_id}`);

        return ok({
          action: "delete_bot",
          executed: true,
          bot_id,
          message: result.msg,
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
