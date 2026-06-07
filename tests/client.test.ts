/**
 * Tests for the API client.
 *
 * Mocks the global fetch to verify:
 * - Correct auth header
 * - Retry on 5xx
 * - Error mapping (401, 403, 429)
 * - Key never appears in error messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SegnalsClient } from "../src/client.js";
import { ApiKeyError, ScopeError, RateLimitError, ServerError } from "../src/errors.js";
import type { SegnalsConfig } from "../src/config.js";

function createClient(overrides: Partial<SegnalsConfig> = {}): SegnalsClient {
  return new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 2,
    ...overrides,
  });
}

function jsonResponse(status: number, body: Record<string, unknown>, headers?: Record<string, string>): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

describe("SegnalsClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication header", () => {
    it("sends the correct Authorization header", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();
      await client.get("/auth/me");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Authorization).toBe("Bearer sk_live_testkey1234567890");
    });

    it("sets Accept: application/json", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();
      await client.get("/auth/me");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers.Accept).toBe("application/json");
    });
  });

  describe("URL construction", () => {
    it("concatenates base URL and path", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();
      await client.get("/bots/");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.test.segnals.com/bots/");
    });

    it("appends query parameters", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();
      await client.get("/bots/trades", { limit: 20, bot_id: 42 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=20");
      expect(url).toContain("bot_id=42");
    });

    it("skips undefined params", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, {}));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();
      await client.get("/bots/trades", { limit: undefined, bot_id: 42 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("limit");
      expect(url).toContain("bot_id=42");
    });
  });

  describe("Error mapping", () => {
    it("throws ApiKeyError on 401", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse(401, { error: "invalid_api_key", message: "Invalid or revoked API key" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();

      await expect(client.get("/auth/me")).rejects.toThrow(ApiKeyError);
      await expect(client.get("/auth/me")).rejects.toThrow(/invalid/i);
    });

    it("throws ScopeError on 403 with required scope", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse(403, {
          error: "insufficient_scope",
          message: "This action requires the 'read:bots' scope",
          required: "read:bots",
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();

      try {
        await client.get("/bots/");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ScopeError);
        expect((e as ScopeError).requiredScope).toBe("read:bots");
        expect((e as ScopeError).message).toContain("read:bots");
      }
    });

    it("throws RateLimitError on 429", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse(429, { error: "rate_limit_exceeded", retry_after: 30 }, { "Retry-After": "30" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient();

      try {
        await client.get("/bots/");
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).retryAfter).toBe(30);
      }
    });

    it("does not retry on 4xx errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse(401, { error: "invalid_api_key", message: "bad key" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient({ maxRetries: 3 });

      await expect(client.get("/auth/me")).rejects.toThrow(ApiKeyError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("Retry behavior", () => {
    it("retries on 5xx errors", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(503, { message: "Service unavailable" }))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient({ maxRetries: 2 });
      // Speed up retries for tests
      vi.spyOn(client as any, "sleep").mockResolvedValue(undefined);

      const result = await client.get("/bots/");
      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws ServerError after exhausting retries", async () => {
      const mockFetch = vi.fn().mockResolvedValue(jsonResponse(500, { message: "Internal error" }));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient({ maxRetries: 1 });
      vi.spyOn(client as any, "sleep").mockResolvedValue(undefined);

      await expect(client.get("/bots/")).rejects.toThrow(ServerError);
      expect(mockFetch).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it("retries on network errors", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient({ maxRetries: 2 });
      vi.spyOn(client as any, "sleep").mockResolvedValue(undefined);

      const result = await client.get("/bots/");
      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Security", () => {
    it("never includes the API key in error messages", async () => {
      const apiKey = "sk_live_supersecretkey12345";
      const mockFetch = vi.fn().mockResolvedValue(
        jsonResponse(401, { error: "invalid_api_key", message: "bad key" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const client = createClient({ apiKey });

      try {
        await client.get("/auth/me");
        expect.fail("Should have thrown");
      } catch (e) {
        const error = e as Error;
        expect(error.message).not.toContain(apiKey);
        expect(error.message).not.toContain("supersecretkey");
      }
    });
  });
});
