/**
 * Tests for notification tools: get_notifications, set_notifications
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SegnalsClient } from "../../src/client.js";
import { registerNotificationTools } from "../../src/tools/notifications.js";

function createMockClient(): SegnalsClient {
  return new SegnalsClient({
    apiKey: "sk_live_testkey1234567890",
    apiBase: "https://api.test.segnals.com",
    timeoutMs: 5000,
    maxRetries: 0,
  });
}

function extractToolHandlers(client: SegnalsClient) {
  const handlers: Record<string, (...args: any[]) => any> = {};
  const mockServer = {
    tool: (name: string, _desc: string, _schema: any, handler: any) => {
      handlers[name] = handler;
    },
  } as unknown as McpServer;
  registerNotificationTools(mockServer, client);
  return handlers;
}

describe("Notification tools", () => {
  let client: SegnalsClient;
  let handlers: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    handlers = extractToolHandlers(client);
  });

  describe("segnals_get_notifications", () => {
    it("calls GET /user/notification-preferences", async () => {
      const prefs = {
        preferences: {
          system_reminders: true,
          daily_report: { enabled: false, hour_utc: 9 },
          performance_alerts: { enabled: true, threshold_pnl_usd: -50 },
        },
      };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(prefs), { status: 200 }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_get_notifications({});
      const data = JSON.parse(result.content[0].text);

      expect(data.preferences.system_reminders).toBe(true);
      expect(data.preferences.performance_alerts.enabled).toBe(true);
      expect(mockFetch.mock.calls[0][0]).toContain("/user/notification-preferences");
    });
  });

  describe("segnals_set_notifications", () => {
    it("calls POST /user/notification-preferences", async () => {
      const updatedPrefs = {
        system_reminders: false,
        daily_report: { enabled: true, hour_utc: 8 },
      };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            msg: "Notification preferences updated.",
            preferences: updatedPrefs,
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", mockFetch);

      const result = await handlers.segnals_set_notifications({
        preferences: { system_reminders: false, daily_report: { enabled: true, hour_utc: 8 } },
      });
      const data = JSON.parse(result.content[0].text);

      expect(data.executed).toBe(true);
      expect(data.message).toContain("updated");
      // Verify POST was sent
      const fetchArgs = mockFetch.mock.calls[0];
      expect(fetchArgs[1].method).toBe("POST");
      expect(fetchArgs[0]).toContain("/user/notification-preferences");
    });
  });
});
