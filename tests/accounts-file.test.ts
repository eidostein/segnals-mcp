/**
 * Tests for the accounts file (SPEC 453 §4.6 case 7, and case 8 for its refusals): which files
 * are refused, and that SEGNALS_API_KEY alone still gives one account, `default`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountsFileError, loadAccounts, readAccountsFile } from "../src/config.js";

// Fake keys. The "_" inside keeps them out of secret scanners' Stripe pattern (sk_live_ + 24 alphanumerics).
const KEY_A = "sk_test_plantedkey_AAAAAAAAAAAAAAAA";
const KEY_B = "sk_live_plantedkey_BBBBBBBBBBBBBBBB";

let dir: string;
let files = 0;

/** Writes a new accounts file with the given permissions and returns its path. */
function accountsFile(content: unknown, mode = 0o600): string {
  const path = join(dir, `accounts-${++files}.json`);
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  chmodSync(path, mode);
  return path;
}

/** The message readAccountsFile refuses with; fails when it accepts. */
function refusal(path: string): string {
  try {
    readAccountsFile(path);
  } catch (error) {
    expect(error).toBeInstanceOf(AccountsFileError);
    return (error as Error).message;
  }
  throw new Error(`${path} was accepted`);
}

const TWO = { accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-b", key: KEY_B }] };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "segnals-accounts-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readAccountsFile", () => {
  it("reads the labelled keys of a file only its owner can read", () => {
    expect(readAccountsFile(accountsFile(TWO, 0o600))).toEqual([
      { label: "vip-a", apiKey: KEY_A },
      { label: "vip-b", apiKey: KEY_B },
    ]);
    expect(readAccountsFile(accountsFile(TWO, 0o400))).toHaveLength(2);
  });

  it.runIf(process.platform !== "win32")("refuses a file the group or others can read, and says chmod 600", () => {
    for (const mode of [0o640, 0o604, 0o644, 0o660, 0o606, 0o610]) {
      const path = accountsFile(TWO, mode);
      const message = refusal(path);
      expect(message, mode.toString(8)).toContain(`chmod 600 ${path}`);
      expect(message, mode.toString(8)).toContain(mode.toString(8));
    }
  });

  it("refuses a repeated label, also when only its case differs", () => {
    const twice = { accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-a", key: KEY_B }] };
    expect(refusal(accountsFile(twice))).toContain('the label "vip-a" repeats "vip-a"');

    const cased = { accounts: [{ label: "vip-a", key: KEY_A }, { label: "VIP-A", key: KEY_B }] };
    expect(refusal(accountsFile(cased))).toContain('the label "VIP-A" repeats "vip-a"');
  });

  it("refuses a malformed key", () => {
    for (const key of ["sk_prod_abcdefghijklmnopqrst", "sk_test_short", "", 42, null]) {
      const file = { accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-b", key }] };
      expect(refusal(accountsFile(file)), String(key)).toContain(
        'account 2 ("vip-b") has a "key" that is not a Segnals API key',
      );
    }
  });

  it("refuses a missing or malformed label", () => {
    for (const label of [undefined, "", "-a", "a b", "a\nb", "x".repeat(65), 7]) {
      const file = { accounts: [{ label, key: KEY_A }] };
      expect(refusal(accountsFile(file)), String(label)).toContain('account 1 needs a "label"');
    }
  });

  it("refuses a label that is an API key, since every answer shows the label", () => {
    for (const label of [KEY_B, "sk_test_x", "SK_LIVE_x"]) {
      const file = { accounts: [{ label, key: KEY_A }] };
      expect(refusal(accountsFile(file)), label).toContain("account 1 has a label that looks like an API key");
    }
  });

  it("refuses one key under two labels", () => {
    const file = { accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-b", key: KEY_A }] };
    expect(refusal(accountsFile(file))).toContain('"vip-b" and "vip-a" hold the same key');
  });

  it("refuses a file that is not the accounts JSON", () => {
    for (const content of ["", "not json", "[]", "{}", '{"accounts": []}', '{"accounts": {}}', "null"]) {
      expect(refusal(accountsFile(content)), content).toMatch(/is not valid JSON|must hold \{"accounts"/);
    }
  });

  it("refuses a path that is missing or a folder", () => {
    expect(refusal(join(dir, "nothing.json"))).toContain("(ENOENT)");
    expect(refusal(dir)).toMatch(/is not a file|\(EISDIR\)/);
  });

  // SPEC 453 §4.6 case 8, for the file: no refusal repeats a key, even when the JSON is broken
  // right next to one, where a parse error would quote the text around it.
  it("never repeats a key in a refusal", () => {
    const broken = `{"accounts": [{"label": "vip-a", "key": "${KEY_A}"}, {"label": "vip-b", "key": "${KEY_B}"`;
    // A key's random part pasted without quotes: JSON.parse's own message quotes the next 10 characters.
    const quoted = `{"accounts": [{"label": "vip-a", "key": ${KEY_A.slice(8)}}]}`;
    let parseMessage = "";
    try {
      JSON.parse(quoted);
    } catch (error) {
      parseMessage = (error as Error).message;
    }
    expect(parseMessage).toContain("plantedkey");

    const files = [
      accountsFile(quoted),
      accountsFile(broken),
      accountsFile({ accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-a", key: KEY_B }] }),
      accountsFile({ accounts: [{ label: "vip-a", key: KEY_A }, { label: "vip-b", key: KEY_A }] }),
      accountsFile({ accounts: [{ label: "vip-a", key: `${KEY_A} ` }] }),
      accountsFile({ accounts: [{ label: KEY_B, key: KEY_A }] }),
      accountsFile(TWO, 0o644),
    ];
    for (const path of files) {
      // The search can find what it looks for: the planted keys are in the file.
      const text = readFileSync(path, "utf8");
      expect(text).toContain("plantedkey");
      const message = refusal(path);
      expect(message).not.toContain("plantedkey");
    }
  });
});

describe("loadAccounts", () => {
  const originalEnv = process.env;
  let exit: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const ours = ["SEGNALS_API_KEY", "SEGNALS_ACCOUNTS_FILE", "SEGNALS_API_BASE", "SEGNALS_TIMEOUT_MS", "SEGNALS_MAX_RETRIES"];
    process.env = Object.fromEntries(Object.entries(originalEnv).filter(([name]) => !ours.includes(name)));
    exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    exit.mockRestore();
    error.mockRestore();
  });

  it("gives SEGNALS_API_KEY alone as the one account `default`", () => {
    process.env.SEGNALS_API_KEY = KEY_A;
    process.env.SEGNALS_API_BASE = "https://test.segnals.com/api/";

    expect(loadAccounts()).toEqual({
      accounts: [{ label: "default", apiKey: KEY_A }],
      apiBase: "https://test.segnals.com/api",
      timeoutMs: 30000,
      maxRetries: 3,
    });
  });

  it("gives every account of SEGNALS_ACCOUNTS_FILE, with the shared settings", () => {
    process.env.SEGNALS_ACCOUNTS_FILE = accountsFile(TWO);
    process.env.SEGNALS_TIMEOUT_MS = "5000";

    const config = loadAccounts();

    expect(config.accounts.map((account) => account.label)).toEqual(["vip-a", "vip-b"]);
    expect(config.timeoutMs).toBe(5000);
    expect(config.apiBase).toBe("https://segnals.com/api");
  });

  it("exits on a refused file, naming the rule and no key", () => {
    process.env.SEGNALS_ACCOUNTS_FILE = accountsFile(TWO, 0o644);

    expect(() => loadAccounts()).toThrow("process.exit called");
    expect(exit).toHaveBeenCalledWith(1);
    const printed = error.mock.calls.flat().join("\n");
    expect(printed).toContain("chmod 600");
    expect(printed).not.toContain(KEY_A);
    expect(printed).not.toContain(KEY_B);
  });

  it("exits when both SEGNALS_ACCOUNTS_FILE and SEGNALS_API_KEY are set", () => {
    process.env.SEGNALS_ACCOUNTS_FILE = accountsFile(TWO);
    process.env.SEGNALS_API_KEY = KEY_A;

    expect(() => loadAccounts()).toThrow("process.exit called");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls.flat().join("\n")).toContain("Set one");
  });

  it("still exits with the SEGNALS_API_KEY message when neither is set", () => {
    expect(() => loadAccounts()).toThrow("process.exit called");
    const printed = error.mock.calls.flat().join("\n");
    expect(printed).toContain("SEGNALS_API_KEY");
    expect(printed).toContain("SEGNALS_ACCOUNTS_FILE");
  });
});
