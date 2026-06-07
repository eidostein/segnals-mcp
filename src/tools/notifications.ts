/**
 * Notification tools — view and update notification preferences.
 *
 * Tools: segnals_get_notifications, segnals_set_notifications
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { NotificationPreferences } from "../types.js";
import { ok, err } from "./helpers.js";

export function registerNotificationTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_notifications ──
  server.tool(
    "segnals_get_notifications",
    `Get your notification preferences: daily reports, performance alerts, weekly summaries, and system reminders. Use this to review current notification settings before updating them. Requires scope: manage:notifications. Example: segnals_get_notifications()`,
    {},
    async () => {
      try {
        const data = await client.get<{ preferences: NotificationPreferences }>(
          "/user/notification-preferences",
        );
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_set_notifications (no confirmation — non-destructive preference update) ──
  server.tool(
    "segnals_set_notifications",
    `Update notification preferences. Requires scope: manage:notifications.

Non-destructive — no confirmation needed. Updates are deep-merged with existing preferences.
Valid keys: system_reminders, daily_report, performance_alerts, weekly_summary, custom_alerts.`,
    {
      preferences: z.record(z.unknown()).describe(
        "Notification preferences to update. Keys: system_reminders (boolean), " +
        "daily_report ({ enabled, hour_utc }), performance_alerts ({ enabled, threshold_pnl_usd }), " +
        "weekly_summary ({ enabled, day, hour_utc }), custom_alerts",
      ),
    },
    async ({ preferences }) => {
      try {
        const result = await client.post<{ msg: string; preferences: NotificationPreferences }>(
          "/user/notification-preferences",
          { preferences, client: "mcp" },
        );

        return ok({
          action: "set_notifications",
          executed: true,
          message: result.msg,
          preferences: result.preferences,
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
