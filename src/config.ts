/**
 * Configuration module for the Segnals MCP server.
 *
 * Reads all config from environment variables — never from argv or committed files.
 * Exits with a friendly message if the API key is missing.
 */

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

  const apiBase = (process.env.SEGNALS_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");

  const timeoutMs = process.env.SEGNALS_TIMEOUT_MS
    ? parseInt(process.env.SEGNALS_TIMEOUT_MS, 10)
    : DEFAULT_TIMEOUT_MS;

  const maxRetries = process.env.SEGNALS_MAX_RETRIES
    ? parseInt(process.env.SEGNALS_MAX_RETRIES, 10)
    : DEFAULT_MAX_RETRIES;

  return { apiKey, apiBase, timeoutMs, maxRetries };
}
