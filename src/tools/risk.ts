/**
 * Risk reading of a bot config — the one place that knows where the engine keeps
 * martingale, leverage and the stop-loss.
 *
 * The write previews (segnals_update_bot, segnals_create_strategy) and
 * segnals_explain_config all call riskWarnings(), so they cannot disagree about a key.
 * The keys are the nested ones the engine reads:
 *   MARTINGALE.ENABLED, TRADING_PARAMS.LEVERAGE, STOP_LOSS.TYPE / STOP_LOSS.VALUE_PCT
 */

export type BotConfig = Record<string, unknown>;

/** Leverage above this is flagged. */
export const HIGH_LEVERAGE = 10;

/** STOP_LOSS.TYPE values whose distance comes from candles, not from VALUE_PCT. */
const CANDLE_STOP_TYPES = ["last_candle_high", "last_candle_low", "last_candle_auto", "hhll"];

export const NO_STOP_LOSS =
  "⚠️ No stop-loss configured (STOP_LOSS.VALUE_PCT is missing). Positions have no downside protection.";

/** For a config applied on top of a new bot's defaults: a missing key is not a missing stop. */
export const STOP_LOSS_LEFT_TO_DEFAULT =
  "⚠️ This config sets no stop-loss (STOP_LOSS.VALUE_PCT). The new bot keeps the platform default: " +
  "read it back with segnals_get_bot before starting the bot.";

function isSection(value: unknown): value is BotConfig {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function section(config: BotConfig, key: string): BotConfig {
  const value = config[key];
  return isSection(value) ? value : {};
}

/** Same reading as the engine's safe_bool: stored values are booleans, numbers or strings. */
function isOn(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "t", "y", "yes"].includes(value.toLowerCase());
  if (typeof value === "number") return value !== 0;
  return false;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export interface ConfigRisk {
  martingale: boolean;
  /** undefined when the config does not name a leverage */
  leverage: number | undefined;
  /** "missing" = the config names no stop-loss at all */
  stopLoss: "set" | "zero" | "missing";
}

export function readConfigRisk(config: BotConfig): ConfigRisk {
  const stop = section(config, "STOP_LOSS");
  const stopPct = toNumber(stop.VALUE_PCT);
  let stopLoss: ConfigRisk["stopLoss"];
  if (typeof stop.TYPE === "string" && CANDLE_STOP_TYPES.includes(stop.TYPE)) {
    stopLoss = "set";
  } else if (stopPct === undefined) {
    stopLoss = "missing";
  } else {
    stopLoss = stopPct > 0 ? "set" : "zero";
  }

  return {
    martingale: isOn(section(config, "MARTINGALE").ENABLED),
    leverage: toNumber(section(config, "TRADING_PARAMS").LEVERAGE),
    stopLoss,
  };
}

/**
 * Human-readable warnings for a config: martingale enabled, leverage above 10x,
 * stop-loss missing or 0.
 *
 * @param missingStopLoss - what to say when the config names no stop-loss. The default
 *   fits a bot's full stored config. Pass null for a partial update whose target could
 *   not be read: there a missing key says nothing about the bot.
 */
export function riskWarnings(
  config: BotConfig,
  { missingStopLoss = NO_STOP_LOSS }: { missingStopLoss?: string | null } = {},
): string[] {
  const { martingale, leverage, stopLoss } = readConfigRisk(config);
  const highLeverage = leverage !== undefined && leverage > HIGH_LEVERAGE;
  const warnings: string[] = [];

  if (martingale && highLeverage) {
    warnings.push(
      `⚠️ HIGH RISK: Martingale is enabled with leverage above ${HIGH_LEVERAGE}x (${leverage}x). ` +
        "This combination can amplify losses rapidly in volatile markets.",
    );
  }
  if (martingale) {
    warnings.push(
      "⚠️ Martingale is enabled (MARTINGALE.ENABLED). Position sizes increase after losses, " +
        "which can lead to significant drawdowns.",
    );
  }
  if (highLeverage) {
    warnings.push(
      `⚠️ High leverage: ${leverage}x (TRADING_PARAMS.LEVERAGE), above ${HIGH_LEVERAGE}x. ` +
        "This raises both potential profit and the risk of liquidation.",
    );
  }
  if (stopLoss === "zero") {
    warnings.push("⚠️ Stop-loss is 0 (STOP_LOSS.VALUE_PCT). Positions have no downside protection.");
  } else if (stopLoss === "missing" && missingStopLoss) {
    warnings.push(missingStopLoss);
  }

  return warnings;
}

/**
 * The config a bot would hold after an update, merged the way PUT /bots/<id> merges it:
 * objects are merged key by key, every other value replaces what was stored.
 */
export function mergeConfig(stored: BotConfig, update: BotConfig): BotConfig {
  const merged: BotConfig = { ...stored };
  for (const [key, value] of Object.entries(update)) {
    const current = merged[key];
    merged[key] = isSection(value) ? mergeConfig(isSection(current) ? current : {}, value) : value;
  }
  return merged;
}
