/**
 * Typed HTTP client for the Segnals REST API.
 *
 * Features:
 * - Authorization: Bearer <key> header (key from config, never logged)
 * - JSON content negotiation
 * - Configurable timeout
 * - Exponential backoff retry on 5xx / network errors
 * - Maps 401/403/429 to clear, actionable error messages
 *
 * Uses Node.js built-in fetch (available since Node 18).
 */

import type { SegnalsConfig } from "./config.js";
import {
  ApiKeyError,
  NetworkError,
  RateLimitError,
  ScopeError,
  SegnalsApiError,
  ServerError,
} from "./errors.js";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
  /** Override the default timeout for this request */
  timeoutMs?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

/**
 * Typed HTTP client for the Segnals REST API.
 */
export class SegnalsClient {
  private readonly apiKey: string;
  private readonly apiBase: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: SegnalsConfig) {
    this.apiKey = config.apiKey;
    this.apiBase = config.apiBase;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
  }

  /**
   * Make an authenticated request to the Segnals API.
   *
   * @param path - API path (e.g., "/auth/me" — will be prefixed with apiBase)
   * @param options - Request options
   * @returns The parsed JSON response data
   * @throws {ApiKeyError} on 401
   * @throws {ScopeError} on 403
   * @throws {RateLimitError} on 429
   * @throws {ServerError} on 5xx
   * @throws {NetworkError} on network failures
   */
  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, params, timeoutMs } = options;

    // Build URL with query parameters
    let url = `${this.apiBase}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    const fetchOptions: RequestInit = { method, headers };

    if (body) {
      headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    }

    // Retry loop with exponential backoff
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, fetchOptions, timeoutMs);
        return await this.handleResponse<T>(response, path);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry client errors (4xx) — they won't change on retry
        if (error instanceof SegnalsApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        await this.sleep(delayMs);
      }
    }

    // If all retries exhausted, throw the last error
    if (lastError instanceof SegnalsApiError) {
      throw lastError;
    }
    throw new NetworkError(lastError?.message ?? "Unknown error after retries");
  }

  /**
   * Convenience method for GET requests.
   */
  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>(path, { method: "GET", params });
  }

  /**
   * Convenience method for POST requests.
   */
  async post<T = unknown>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  /**
   * Convenience method for PUT requests.
   */
  async put<T = unknown>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.request<T>(path, { method: "PUT", body });
  }

  /**
   * Convenience method for DELETE requests.
   */
  async del<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  /**
   * Fetch with a timeout using AbortController.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new NetworkError(`Request timed out after ${timeout}ms`);
      }
      // Map other fetch errors to NetworkError
      const msg = error instanceof Error ? error.message : String(error);
      throw new NetworkError(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Handle the HTTP response, mapping status codes to typed errors.
   */
  private async handleResponse<T>(response: Response, path: string): Promise<T> {
    // Parse body (may be empty for some error responses)
    let body: Record<string, unknown> = {};
    try {
      const text = await response.text();
      if (text) {
        body = JSON.parse(text) as Record<string, unknown>;
      }
    } catch {
      // Body wasn't JSON — that's okay, we'll use status code for error mapping
    }

    if (response.ok) {
      return body as T;
    }

    const detail = (body.message as string) ?? (body.msg as string) ?? "";

    switch (response.status) {
      case 401:
        throw new ApiKeyError(detail || undefined);

      case 403: {
        // Extract scope from the error response if available
        const requiredScope = (body.required as string) ?? "unknown";
        throw new ScopeError(requiredScope);
      }

      case 429: {
        const retryAfter = parseInt(
          response.headers.get("Retry-After") ?? String(body.retry_after ?? ""),
          10,
        );
        throw new RateLimitError(isNaN(retryAfter) ? undefined : retryAfter);
      }

      case 404:
        throw new SegnalsApiError(
          `Resource not found: ${path}. ${detail}`,
          404,
          "not_found",
        );

      default:
        if (response.status >= 500) {
          throw new ServerError(response.status, detail || undefined);
        }
        throw new SegnalsApiError(
          detail || `API request failed with status ${response.status}`,
          response.status,
          "api_error",
        );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
