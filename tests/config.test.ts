/**
 * Tests for the config module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, isValidKeyFormat } from "../src/config.js";

describe("isValidKeyFormat", () => {
  it("accepts valid live keys", () => {
    expect(isValidKeyFormat("sk_live_abcdefghijklmnop")).toBe(true);
    expect(isValidKeyFormat("sk_live_not_a_real_key_just_for_testing")).toBe(true);
  });

  it("accepts valid test keys", () => {
    expect(isValidKeyFormat("sk_test_abcdefghijklmnop")).toBe(true);
  });

  it("rejects keys without sk_ prefix", () => {
    expect(isValidKeyFormat("abcdefghijklmnop")).toBe(false);
    expect(isValidKeyFormat("pk_live_abcdefghijklmnop")).toBe(false);
  });

  it("rejects keys that are too short", () => {
    expect(isValidKeyFormat("sk_live_abc")).toBe(false);
    expect(isValidKeyFormat("sk_test_short")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidKeyFormat("")).toBe(false);
  });

  it("rejects keys with invalid mode", () => {
    expect(isValidKeyFormat("sk_prod_abcdefghijklmnop")).toBe(false);
    expect(isValidKeyFormat("sk_dev_abcdefghijklmnop")).toBe(false);
  });
});

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads config from environment variables", () => {
    process.env.SEGNALS_API_KEY = "sk_live_abcdefghijklmnop";
    process.env.SEGNALS_API_BASE = "https://staging.segnals.com/api";

    const config = loadConfig();

    expect(config.apiKey).toBe("sk_live_abcdefghijklmnop");
    expect(config.apiBase).toBe("https://staging.segnals.com/api");
    expect(config.timeoutMs).toBe(30000);
    expect(config.maxRetries).toBe(3);
  });

  it("uses default API base when not set", () => {
    process.env.SEGNALS_API_KEY = "sk_live_abcdefghijklmnop";
    delete process.env.SEGNALS_API_BASE;

    const config = loadConfig();

    expect(config.apiBase).toBe("https://segnals.com/api");
  });

  it("strips trailing slashes from API base", () => {
    process.env.SEGNALS_API_KEY = "sk_live_abcdefghijklmnop";
    process.env.SEGNALS_API_BASE = "https://segnals.com/api///";

    const config = loadConfig();

    expect(config.apiBase).toBe("https://segnals.com/api");
  });

  it("exits with code 1 when no API key is set", () => {
    delete process.env.SEGNALS_API_KEY;

    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockError).toHaveBeenCalled();

    // Check the error message mentions API key
    const errorMessage = mockError.mock.calls[0][0] as string;
    expect(errorMessage).toContain("SEGNALS_API_KEY");

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it("exits with code 1 for invalid key format", () => {
    process.env.SEGNALS_API_KEY = "invalid_key_format";

    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => loadConfig()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it("reads custom timeout from env", () => {
    process.env.SEGNALS_API_KEY = "sk_live_abcdefghijklmnop";
    process.env.SEGNALS_TIMEOUT_MS = "5000";

    const config = loadConfig();

    expect(config.timeoutMs).toBe(5000);
  });

  it("reads custom max retries from env", () => {
    process.env.SEGNALS_API_KEY = "sk_live_abcdefghijklmnop";
    process.env.SEGNALS_MAX_RETRIES = "5";

    const config = loadConfig();

    expect(config.maxRetries).toBe(5);
  });
});
