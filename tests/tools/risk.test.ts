/**
 * Tests for the shared risk reader: the keys are the nested ones the engine reads.
 */

import { describe, it, expect } from "vitest";
import {
  mergeConfig,
  NO_STOP_LOSS,
  readConfigRisk,
  riskWarnings,
  STOP_LOSS_LEFT_TO_DEFAULT,
} from "../../src/tools/risk.js";

describe("riskWarnings", () => {
  it("reads martingale and leverage from the nested keys the engine uses", () => {
    const warnings = riskWarnings({
      MARTINGALE: { ENABLED: true },
      TRADING_PARAMS: { LEVERAGE: 20 },
      STOP_LOSS: { TYPE: "percentage", VALUE_PCT: 0.5 },
    });

    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain("HIGH RISK");
    expect(warnings[1]).toContain("MARTINGALE.ENABLED");
    expect(warnings[2]).toContain("20x (TRADING_PARAMS.LEVERAGE)");
  });

  it("does not report a missing stop-loss when STOP_LOSS.VALUE_PCT is set", () => {
    expect(riskWarnings({ STOP_LOSS: { VALUE_PCT: 2 } })).toEqual([]);
  });

  // The flat spellings were what the old helpers read; the engine never did.
  it("ignores flat keys the engine never reads", () => {
    const warnings = riskWarnings({ MARTINGALE_ENABLED: true, LEVERAGE: 20, STOP_LOSS_PERCENT: 2 });

    expect(warnings).toEqual([NO_STOP_LOSS]);
  });

  it("flags leverage above 10x and not 10x itself", () => {
    const stop = { STOP_LOSS: { VALUE_PCT: 1 } };

    expect(riskWarnings({ ...stop, TRADING_PARAMS: { LEVERAGE: 10 } })).toEqual([]);
    expect(riskWarnings({ ...stop, TRADING_PARAMS: { LEVERAGE: 11 } })).toHaveLength(1);
  });

  it("warns when the stop-loss is 0 or missing", () => {
    expect(riskWarnings({ STOP_LOSS: { TYPE: "percentage", VALUE_PCT: 0 } })[0]).toContain("Stop-loss is 0");
    expect(riskWarnings({})).toEqual([NO_STOP_LOSS]);
  });

  it("counts a candle-based stop as a stop-loss", () => {
    expect(riskWarnings({ STOP_LOSS: { TYPE: "last_candle_auto", VALUE_PCT: 0 } })).toEqual([]);
  });

  it("says what the caller asks about a stop-loss the config does not name", () => {
    expect(riskWarnings({}, { missingStopLoss: STOP_LOSS_LEFT_TO_DEFAULT })).toEqual([STOP_LOSS_LEFT_TO_DEFAULT]);
    expect(riskWarnings({}, { missingStopLoss: null })).toEqual([]);
  });

  it("reads stored strings the way the engine does", () => {
    expect(readConfigRisk({ MARTINGALE: { ENABLED: "false" } }).martingale).toBe(false);
    expect(readConfigRisk({ MARTINGALE: { ENABLED: "true" } }).martingale).toBe(true);
    expect(readConfigRisk({ TRADING_PARAMS: { LEVERAGE: "25" } }).leverage).toBe(25);
  });
});

describe("mergeConfig", () => {
  it("merges nested sections and leaves their other keys alone", () => {
    const stored = {
      STOP_LOSS: { TYPE: "percentage", VALUE_PCT: 0.5 },
      TRADING_PARAMS: { LEVERAGE: 5, TAKE_PROFIT_PCT: 1 },
    };

    const merged = mergeConfig(stored, { TRADING_PARAMS: { LEVERAGE: 25 } });

    expect(merged).toEqual({
      STOP_LOSS: { TYPE: "percentage", VALUE_PCT: 0.5 },
      TRADING_PARAMS: { LEVERAGE: 25, TAKE_PROFIT_PCT: 1 },
    });
    expect(stored.TRADING_PARAMS.LEVERAGE).toBe(5);
  });

  it("replaces a value that is not a section", () => {
    expect(mergeConfig({ MEMECOINS: ["BTCUSDT"] }, { MEMECOINS: ["ETHUSDT"] })).toEqual({
      MEMECOINS: ["ETHUSDT"],
    });
  });
});
