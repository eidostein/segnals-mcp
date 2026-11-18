/**
 * Meta tools — connection verification and platform information.
 *
 * Tools: segnals_whoami, segnals_get_capabilities, segnals_get_safety_disclaimer
 */


import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { UserProfile } from "../types.js";
import { SegnalsApiError } from "../errors.js";
import { ok, err, USE_FLEET_PLANS } from "./helpers.js";
import { ENGINES } from "./fleet.js";

/** All available tools with their required scopes */
const TOOL_CATALOG = [
  // Accounts (local: the labels and key modes this program holds)
  { name: "segnals_list_accounts", scope: "(none, local)", type: "read" },
  // Meta (any key)
  { name: "segnals_whoami", scope: "(any valid key)", type: "read" },
  { name: "segnals_get_capabilities", scope: "(any valid key)", type: "read" },
  { name: "segnals_get_safety_disclaimer", scope: "(any valid key)", type: "read" },
  // Account (read)
  { name: "segnals_get_account", scope: "read:account", type: "read" },
  { name: "segnals_get_subscription", scope: "read:account", type: "read" },
  { name: "segnals_list_connections", scope: "read:account", type: "read" },
  // Stats (read)
  { name: "segnals_get_dashboard", scope: "read:stats", type: "read" },
  { name: "segnals_get_pnl_summary", scope: "read:stats", type: "read" },
  { name: "segnals_get_bot_performance", scope: "read:stats", type: "read" },
  { name: "segnals_get_trades", scope: "read:stats", type: "read" },
  // Bots (read)
  { name: "segnals_list_bots", scope: "read:bots", type: "read" },
  { name: "segnals_get_bot", scope: "read:bots", type: "read" },
  { name: "segnals_get_bot_logs", scope: "read:bots", type: "read" },
  { name: "segnals_get_strategy_schema", scope: "read:bots", type: "read" },
  { name: "segnals_explain_config", scope: "read:bots", type: "read" },
  // Bots (write/control) — ✋ = requires confirm: true
  { name: "segnals_create_bot", scope: "write:bots", type: "write", confirm: true },
  { name: "segnals_update_bot", scope: "write:bots", type: "write", confirm: true },
  { name: "segnals_start_bot", scope: "control:bots", type: "write", confirm: true },
  { name: "segnals_stop_bot", scope: "control:bots", type: "write" },
  { name: "segnals_restart_bot", scope: "control:bots", type: "write", confirm: true },
  { name: "segnals_delete_bot", scope: "write:bots", type: "write", confirm: true },
  // Strategies (write)
  { name: "segnals_create_strategy", scope: "write:strategies", type: "write", confirm: true },
  { name: "segnals_set_indicator_filter", scope: "write:bots", type: "write" },
  // Marketplace (read)
  { name: "segnals_browse_marketplace", scope: "read:marketplace", type: "read" },
  { name: "segnals_get_listing", scope: "read:marketplace", type: "read" },
  { name: "segnals_my_listings", scope: "read:marketplace", type: "read" },
  // Marketplace (write)
  { name: "segnals_copy_strategy", scope: "write:marketplace", type: "write", confirm: true },
  { name: "segnals_publish_listing", scope: "write:marketplace", type: "write", confirm: true },
  // News (read). The read:knowledge scope has no tool yet.
  { name: "segnals_get_news", scope: "read:news", type: "read" },
  // Copy trading
  { name: "segnals_get_copy_trading", scope: "read:account", type: "read" },
  { name: "segnals_control_copy_trading", scope: "control:bots", type: "write", confirm: true },
  // Notifications
  { name: "segnals_get_notifications", scope: "manage:notifications", type: "read" },
  { name: "segnals_set_notifications", scope: "manage:notifications", type: "write" },
  // Fleet (SPEC 453): the settings catalog for any key; the fleet, its report and its plans for a master key
  { name: "segnals_get_settings_catalog", scope: "(any valid key)", type: "read" },
  { name: "segnals_get_fleet", scope: "manage:fleet", type: "read" },
  { name: "segnals_fleet_report", scope: "read:stats", type: "read" },
  // Fleet plans (SPEC 453): check changes nothing; apply and stop all change bots
  { name: "segnals_plan_fleet", scope: "manage:fleet", type: "read" },
  { name: "segnals_get_fleet_plan", scope: "manage:fleet", type: "read" },
  { name: "segnals_apply_fleet_plan", scope: "manage:fleet", type: "write", confirm: true },
  { name: "segnals_stop_all_fleet", scope: "manage:fleet", type: "write" },
];

/** The resources the server offers, beside its tools. */
const RESOURCE_CATALOG = [
  {
    uri_template: "segnals://settings/{engine}",
    engines: [...ENGINES],
    scope: "(any valid key)",
    reads: "the settings catalog, as segnals_get_settings_catalog answers it, with the program's first account",
  },
];

const SAFETY_DISCLAIMER = `Segnals MCP — Risk & Safety Disclaimer

IMPORTANT: Segnals is a SOFTWARE TOOL for managing algorithmic trading configurations. 
It is NOT financial advice, an investment advisor, or a portfolio manager.

Key points:
• Trading cryptocurrencies and forex carries significant risk of loss.
• Past performance (including backtest results) does not guarantee future results.
• You are solely responsible for your trading decisions and capital.
• The AI agent operating through this MCP server cannot move funds, access exchange 
  credentials, or perform administrative actions on your behalf.
• All bot creation, strategy changes, and destructive actions require explicit confirmation.
• Segnals does not have custody of your funds — your exchange holds your capital.

By using this tool, you acknowledge that you understand these risks and that Segnals 
provides software automation, not financial advice.`;

export function registerMetaTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_whoami ──
  server.tool(
    "segnals_whoami",
    `Verify your API key and check your Segnals identity. Returns your username, account tier, and connection status. Use this as the FIRST call to confirm the API key is working. Requires: any valid API key. Example: segnals_whoami()`,
    {},
    async () => {
      try {
        const profile = await client.get<UserProfile>("/user/me");
        return ok({
          username: profile.username,
          tier: profile.tier,
          language: profile.language,
          subscription_ends_at: profile.subscription_ends_at,
          has_completed_onboarding: profile.has_completed_onboarding,
          status: "connected",
        });
      } catch (error) {
        const result = err(error);
        // Add first-run guidance on auth failure. A master key is refused this route (`use_fleet_plans`)
        // although it works, so it gets the fleet tools from err() and no advice to make a new key.
        const masterKey = error instanceof SegnalsApiError && error.apiError === USE_FLEET_PLANS;
        if (result.isError && !masterKey) {
          result.content[0].text +=
            "\n\nTo fix this:\n" +
            "1. Go to https://segnals.com → Settings → API Keys\n" +
            "2. Generate a new key with the scopes you need\n" +
            "3. Set SEGNALS_API_KEY in your environment\n" +
            "4. Restart the MCP server";
        }
        return result;
      }
    },
  );

  // ── segnals_get_capabilities ──
  server.tool(
    "segnals_get_capabilities",
    `List all available Segnals MCP tools and their required scopes. Use this to understand what actions you can perform with the current API key. Requires: any valid API key. Example: segnals_get_capabilities()`,
    {},
    async () => {
      return ok({
        server: "segnals-mcp",
        version: "0.2.0",
        transport: "stdio",
        tools: TOOL_CATALOG,
        resources: RESOURCE_CATALOG,
        note: "Tools marked with scope '(any valid key)' work with any valid API key. segnals_list_accounts needs no scope for the labels and key modes, which it reads locally. Other tools require the listed scope to be granted to your key. manage:fleet is held only by a master key, which the account holder creates in Settings → Bot manager; segnals_get_fleet, segnals_fleet_report and the plan tools (segnals_plan_fleet, segnals_get_fleet_plan, segnals_apply_fleet_plan, segnals_stop_all_fleet) answer a master key only. A master key gets use_fleet_plans from any other tool whose route it may not use: it changes its fleet through plans only. With several accounts, each tool call names one with the account argument, and the scopes are that account's key's.",
      });
    },
  );

  // ── segnals_get_safety_disclaimer ──
  server.tool(
    "segnals_get_safety_disclaimer",
    `Returns the Segnals risk and safety disclaimer. This explains that Segnals is a software tool (not financial advice), outlines trading risks, and clarifies what the MCP server can and cannot do. Present this to users before creating strategies or starting bots. Requires: any valid API key. Example: segnals_get_safety_disclaimer()`,
    {},
    async () => {
      return ok({ disclaimer: SAFETY_DISCLAIMER });
    },
  );
}

export { TOOL_CATALOG, RESOURCE_CATALOG, SAFETY_DISCLAIMER };
