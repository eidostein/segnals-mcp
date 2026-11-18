/**
 * Configuration module for the Segnals MCP server.
 *
 * Reads all config from environment variables — never from argv or committed files.
 * Several accounts come from a local file that SEGNALS_ACCOUNTS_FILE names; it is refused
 * unless only its owner can read it.
 * Exits with a friendly message if the API key is missing.
 */

import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";

export interface SegnalsConfig {
  /** The user's Segnals API key (sk_live_* or sk_test_*) */
  apiKey: string;
  /** Base URL for the Segnals REST API */
  apiBase: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts for 5xx / network errors */
  maxRetries: number;
}

const DEFAULT_API_BASE = "https://segnals.com/api";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Validates that the API key matches the expected format: sk_live_* or sk_test_*
 */
export function isValidKeyFormat(key: string): boolean {
  return /^sk_(live|test)_[A-Za-z0-9_-]{16,}$/.test(key);
}

/**
 * Loads and validates configuration from environment variables.
 *
 * @throws Never — exits process with code 1 and a friendly message if config is invalid.
 */
export function loadConfig(): SegnalsConfig {
  const apiKey = process.env.SEGNALS_API_KEY;

  if (!apiKey) {
    // Friendly exit with setup instructions
    const message = `
╔══════════════════════════════════════════════════════════════╗
║  Segnals MCP Server — API Key Required                      ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  No SEGNALS_API_KEY found in your environment.               ║
║                                                              ║
║  To get started:                                             ║
║  1. Sign in at https://segnals.com                           ║
║  2. Go to Settings → API Keys                                ║
║  3. Generate a new key with the scopes you need              ║
║  4. Set it in your environment:                              ║
║                                                              ║
║     export SEGNALS_API_KEY=sk_live_your_key_here             ║
║                                                              ║
║  For detailed setup instructions, see:                       ║
║  docs/GETTING_STARTED.md                                     ║
║                                                              ║
║  For several accounts, set SEGNALS_ACCOUNTS_FILE instead:    ║
║  docs/CONFIGURATION.md → Several accounts                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;
    console.error(message);
    process.exit(1);
  }

  if (!isValidKeyFormat(apiKey)) {
    console.error(
      `\n  Error: SEGNALS_API_KEY has an invalid format.\n` +
        `  Expected: sk_live_<random> or sk_test_<random>\n` +
        `  Got: ${apiKey.substring(0, 8)}...\n\n` +
        `  Generate a valid key at https://segnals.com → Settings → API Keys\n`,
    );
    process.exit(1);
  }

  return { apiKey, ...loadSharedSettings() };
}

/** The settings every account shares: the API base, the timeout and the retries. */
function loadSharedSettings(): Omit<SegnalsConfig, "apiKey"> {
  const apiBase = (process.env.SEGNALS_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");

  const timeoutMs = process.env.SEGNALS_TIMEOUT_MS
    ? parseInt(process.env.SEGNALS_TIMEOUT_MS, 10)
    : DEFAULT_TIMEOUT_MS;

  const maxRetries = process.env.SEGNALS_MAX_RETRIES
    ? parseInt(process.env.SEGNALS_MAX_RETRIES, 10)
    : DEFAULT_MAX_RETRIES;

  return { apiBase, timeoutMs, maxRetries };
}

/** One account the program holds a key for. */
export interface AccountEntry {
  /** The name the owner chose; every tool takes it as `account`. */
  label: string;
  apiKey: string;
}

export interface AccountsConfig extends Omit<SegnalsConfig, "apiKey"> {
  accounts: AccountEntry[];
}

/** The label of the one account SEGNALS_API_KEY gives. */
export const DEFAULT_ACCOUNT_LABEL = "default";

const LABEL_FORMAT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const KEY_PREFIX = /^sk_(live|test)_/i;

/** Any of these bits lets the group or others at the file, as ssh judges a private key. */
const NOT_OWNER_ONLY = 0o077;

/**
 * The accounts file was refused. The message names the file, the entry and the rule,
 * never a key: a JSON parse error can quote the text it failed on, so it is not passed on.
 */
export class AccountsFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountsFileError";
  }
}

/**
 * Reads `{"accounts": [{"label": "vip-a", "key": "sk_test_…"}, …]}` from `path`.
 *
 * Refuses the file when the group or others have any permission on it, when it is not that
 * JSON, when a label is missing, malformed or repeated, when a key is malformed, and when two
 * labels share one key. The permission is read from the open file, so it is the file that is read.
 *
 * @throws {AccountsFileError}
 */
export function readAccountsFile(path: string): AccountEntry[] {
  let text: string;
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const stat = fstatSync(fd);
    if (!stat.isFile()) {
      throw new AccountsFileError(`${path} is not a file.`);
    }
    // Windows has no POSIX permission bits: fstat reports 0o666 for every file.
    if (process.platform !== "win32" && (stat.mode & NOT_OWNER_ONLY) !== 0) {
      const mode = (stat.mode & 0o777).toString(8).padStart(3, "0");
      throw new AccountsFileError(
        `${path} holds API keys and other users can read it (permissions ${mode}). ` +
          `Run: chmod 600 ${path}`,
      );
    }
    text = readFileSync(fd, "utf8");
  } catch (error) {
    if (error instanceof AccountsFileError) throw error;
    const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
    throw new AccountsFileError(`Cannot read ${path} (${code}).`);
  } finally {
    if (fd !== undefined) closeSync(fd);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AccountsFileError(`${path} is not valid JSON.`);
  }

  const list = (data as { accounts?: unknown } | null)?.accounts;
  if (!Array.isArray(list) || list.length === 0) {
    throw new AccountsFileError(
      `${path} must hold {"accounts": [{"label": "…", "key": "sk_…"}, …]} with at least one account.`,
    );
  }

  const entries: AccountEntry[] = [];
  const labels = new Map<string, string>();
  const keys = new Map<string, string>();
  list.forEach((item: unknown, index: number) => {
    const where = `${path}: account ${index + 1}`;
    const { label, key } = (item ?? {}) as { label?: unknown; key?: unknown };
    if (typeof label !== "string" || !LABEL_FORMAT.test(label)) {
      throw new AccountsFileError(
        `${where} needs a "label" of 1 to 64 letters, digits, ".", "_" or "-", starting with a letter or digit.`,
      );
    }
    if (KEY_PREFIX.test(label)) {
      throw new AccountsFileError(
        `${where} has a label that looks like an API key. A label is a name, and every answer shows it.`,
      );
    }
    if (typeof key !== "string" || !isValidKeyFormat(key)) {
      throw new AccountsFileError(
        `${where} ("${label}") has a "key" that is not a Segnals API key (sk_live_… or sk_test_…).`,
      );
    }
    const folded = label.toLowerCase();
    const sameLabel = labels.get(folded);
    if (sameLabel !== undefined) {
      throw new AccountsFileError(`${path}: the label "${label}" repeats "${sameLabel}". Each label names one account.`);
    }
    const sameKey = keys.get(key);
    if (sameKey !== undefined) {
      throw new AccountsFileError(`${path}: "${label}" and "${sameKey}" hold the same key. Each key is one account's.`);
    }
    labels.set(folded, label);
    keys.set(key, label);
    entries.push({ label, apiKey: key });
  });
  return entries;
}

/**
 * The accounts this program acts for: the file SEGNALS_ACCOUNTS_FILE names, or the one key
 * SEGNALS_API_KEY gives, labelled `default`. Setting both is refused, so it is never unclear
 * which key acts.
 *
 * @throws Never — exits process with code 1 and a friendly message if config is invalid.
 */
export function loadAccounts(): AccountsConfig {
  const file = process.env.SEGNALS_ACCOUNTS_FILE;

  if (!file) {
    const { apiKey, ...rest } = loadConfig();
    return { ...rest, accounts: [{ label: DEFAULT_ACCOUNT_LABEL, apiKey }] };
  }

  if (process.env.SEGNALS_API_KEY) {
    console.error(
      `\n  Error: both SEGNALS_ACCOUNTS_FILE and SEGNALS_API_KEY are set.\n` +
        `  Set one: the accounts file for several accounts, or SEGNALS_API_KEY for one.\n`,
    );
    process.exit(1);
  }

  let accounts: AccountEntry[];
  try {
    accounts = readAccountsFile(file);
  } catch (error) {
    const message = error instanceof AccountsFileError ? error.message : "The accounts file was refused.";
    console.error(`\n  Error: ${message}\n`);
    process.exit(1);
  }

  return { ...loadSharedSettings(), accounts };
}
