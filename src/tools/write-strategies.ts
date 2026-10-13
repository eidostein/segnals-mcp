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
import { riskWarnings, STOP_LOSS_LEFT_TO_DEFAULT } from "./risk.js";

type ParamKind = "period" | "number" | readonly string[];

/**
 * The settings each indicator gate reads under INDICATOR_FILTER.<NAME>, as the engine
 * names them. A param outside this table would be stored and never read.
 */
const INDICATOR_PARAMS: Record<"adx" | "rsi" | "ema" | "atr", Record<string, ParamKind>> = {
  adx: { PERIOD: "period", MIN: "number", MAX: "number" },
  rsi: {
    PERIOD: "period",
    MODE: ["filter_extremes", "require_band"],
    OVERBOUGHT: "number",
    OVERSOLD: "number",
  },
  ema: { FAST: "period", SLOW: "period" },
  atr: { PERIOD: "period", MIN_PCT: "number", MAX_PCT: "number" },
};

/** Why a param value cannot be stored, or null when it can. */
function paramProblem(kind: ParamKind, value: unknown): string | null {
  if (kind === "period") {
    return typeof value === "number" && Number.isInteger(value) && value > 0
      ? null
      : "must be a whole number above 0";
  }
  if (kind === "number") {
    return typeof value === "number" && Number.isFinite(value) ? null : "must be a number";
  }
  return typeof value === "string" && kind.includes(value)
    ? null
    : `must be one of: ${kind.join(", ")}`;
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
      config: z
        .record(z.unknown())
        .describe(
          "Strategy configuration, nested as segnals_get_bot shows it, e.g. " +
            "{ TRADING_PARAMS: { LEVERAGE: 3 }, STOP_LOSS: { VALUE_PCT: 2 } }. " +
            "Settings it does not name keep the platform default.",
        ),
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

        // The config lands on top of a new bot's defaults, so a stop-loss it does not
        // name is left to the default, not removed.
        const warnings = riskWarnings(config, { missingStopLoss: STOP_LOSS_LEFT_TO_DEFAULT });

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
            warnings_basis: "only the keys in this config; every setting it does not name keeps the platform default",
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
    `Switch one gate of a bot's indicator filter (ADX, RSI, EMA or ATR) on or off and set its parameters. Requires scope: write:bots.

Writes INDICATOR_FILTER.<NAME>.ENABLED and the given params into the bot's config; no confirmation required. Enabling a gate also sets the master switch INDICATOR_FILTER.ENABLED, which the engine needs before it runs any gate, so a gate already stored as enabled becomes active too. Disabling leaves the master switch alone.
Params per gate (others are refused, nothing is written): adx: period, min, max. rsi: period, mode ("filter_extremes" | "require_band"), overbought, oversold. ema: fast, slow. atr: period, min_pct, max_pct.
All gates share INDICATOR_FILTER.TIMEFRAME (default "D"); change it with segnals_update_bot. If the bot is running, restart it to be sure the change is applied.`,
    {
      bot_id: z.number().int().positive().describe("Bot ID to configure"),
      filter_type: z.enum(["adx", "rsi", "ema", "atr"]).describe("Indicator gate to configure"),
      enabled: z.boolean().describe("Switch the gate on or off"),
      params: z
        .record(z.unknown())
        .optional()
        .describe("Gate parameters, e.g. { period: 14, min: 25 } for adx. Keys are case-insensitive."),
    },
    async ({ bot_id, filter_type, enabled, params }) => {
      try {
        const name = filter_type.toUpperCase();
        const allowed = INDICATOR_PARAMS[filter_type];
        const gate: Record<string, unknown> = { ENABLED: enabled };

        const problems: string[] = [];
        for (const [rawKey, value] of Object.entries(params ?? {})) {
          const key = rawKey.toUpperCase();
          if (!Object.hasOwn(allowed, key)) {
            problems.push(`'${rawKey}' is not a setting of the ${name} gate`);
            continue;
          }
          const problem = paramProblem(allowed[key], value);
          if (problem) {
            problems.push(`'${rawKey}' ${problem}`);
            continue;
          }
          gate[key] = value;
        }
        if (problems.length > 0) {
          return err(
            new Error(
              `Nothing was written. ${problems.join("; ")}. ` +
                `The ${name} gate accepts: ${Object.keys(allowed).map(k => k.toLowerCase()).join(", ")}.`,
            ),
          );
        }

        // The engine runs no gate while INDICATOR_FILTER.ENABLED is off.
        const config = {
          INDICATOR_FILTER: { ...(enabled ? { ENABLED: true } : {}), [name]: gate },
        };

        const result = await client.put<{ msg: string; warning?: string }>(
          `/bots/${bot_id}`,
          { config, client: "mcp" },
        );

        return ok({
          action: "set_indicator_filter",
          executed: true,
          bot_id,
          filter_type,
          enabled,
          written: config,
          message: result.msg,
          ...(result.warning ? { warning: result.warning } : {}),
          note: enabled
            ? "The master switch INDICATOR_FILTER.ENABLED is now on: every gate stored as enabled is active. " +
              "If the bot is running, restart it to be sure the change is applied."
            : "If the bot is running, restart it to be sure the change is applied.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
