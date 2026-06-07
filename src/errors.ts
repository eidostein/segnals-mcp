/**
 * Typed error classes for the Segnals MCP server.
 *
 * Maps HTTP status codes from the Segnals API to clear, actionable messages
 * that help the agent (and user) understand what went wrong and how to fix it.
 */

/**
 * Base class for all Segnals API errors.
 */
export class SegnalsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = "SegnalsApiError";
  }
}

/**
 * 401 — Invalid, expired, or revoked API key.
 */
export class ApiKeyError extends SegnalsApiError {
  constructor(detail?: string) {
    super(
      `Your Segnals API key is invalid or expired. ${detail ?? "Generate a new one in Settings → API Keys at https://segnals.com."}`,
      401,
      "invalid_api_key",
    );
    this.name = "ApiKeyError";
  }
}

/**
 * 403 — The API key lacks a required scope.
 */
export class ScopeError extends SegnalsApiError {
  constructor(public readonly requiredScope: string) {
    super(
      `This key lacks the required scope (\`${requiredScope}\`). Add it to your key or create a new key with this scope at Settings → API Keys.`,
      403,
      "insufficient_scope",
    );
    this.name = "ScopeError";
  }
}

/**
 * 429 — Rate limit exceeded.
 */
export class RateLimitError extends SegnalsApiError {
  constructor(public readonly retryAfter?: number) {
    super(
      `Rate limit reached — wait ${retryAfter ? `${retryAfter} seconds` : "a moment"} and retry.`,
      429,
      "rate_limit_exceeded",
    );
    this.name = "RateLimitError";
  }
}

/**
 * 5xx — Server-side error (may be transient).
 */
export class ServerError extends SegnalsApiError {
  constructor(statusCode: number, detail?: string) {
    super(
      `Segnals API returned a server error (${statusCode}). ${detail ?? "This may be temporary — try again shortly."}`,
      statusCode,
      "server_error",
    );
    this.name = "ServerError";
  }
}

/**
 * Network error (timeout, DNS, connection refused, etc.)
 */
export class NetworkError extends SegnalsApiError {
  constructor(detail: string) {
    super(
      `Could not reach the Segnals API: ${detail}. Check your network connection and SEGNALS_API_BASE setting.`,
      0,
      "network_error",
    );
    this.name = "NetworkError";
  }
}
