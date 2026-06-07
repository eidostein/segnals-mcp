/**
 * Account tools — user account, subscription, and connection status.
 *
 * Tools: segnals_get_account, segnals_get_subscription, segnals_list_connections
 */


import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { UserProfile, ConnectionStatus } from "../types.js";
import { ok, err } from "./helpers.js";

export function registerAccountTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_account ──
  server.tool(
    "segnals_get_account",
    `Get your Segnals account details: tier, subscription status, bot limits, and usage. Use this to check account standing or before creating bots. Requires scope: read:account. Example: segnals_get_account()`,
    {},
    async () => {
      try {
        const profile = await client.get<UserProfile>("/auth/me");
        return ok({
          username: profile.username,
          tier: profile.tier,
          subscription_ends_at: profile.subscription_ends_at,
          trial_expires_at: profile.trial_expires_at,
          language: profile.language,
          has_completed_onboarding: profile.has_completed_onboarding,
        });
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_subscription ──
  server.tool(
    "segnals_get_subscription",
    `Get your current subscription plan, billing status, and payment history. Use this to check if the user's subscription is active, when it renews, or what plan they're on. Requires scope: read:account. Example: segnals_get_subscription()`,
    {},
    async () => {
      try {
        const billing = await client.get<Record<string, unknown>>("/user/billing");
        return ok(billing);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_list_connections ──
  server.tool(
    "segnals_list_connections",
    `Check which exchanges and services are connected to the user's account. Returns boolean flags only (true/false for each exchange) — never returns credentials or secrets. Use this to verify exchange connectivity before creating bots. Requires scope: read:account. Example: segnals_list_connections()`,
    {},
    async () => {
      try {
        const data = await client.get<{ connections: ConnectionStatus }>(
          "/user/connections-status",
        );
        return ok({
          connections: data.connections,
          note: "true = connected, false = not connected. To add connections, go to Settings → Connections at https://segnals.com.",
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
