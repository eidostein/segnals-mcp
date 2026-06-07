/**
 * Meta tools — connection verification and platform information.
 *
 * Tools: segnals_whoami, segnals_get_capabilities, segnals_get_safety_disclaimer
 */


import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import type { UserProfile } from "../types.js";
import { ok, err } from "./helpers.js";

/** All available tools with their required scopes */
const TOOL_CATALOG = [
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
  // News / Knowledge (read)
  { name: "segnals_get_news", scope: "read:news", type: "read" },
  { name: "segnals_get_sentiment", scope: "read:news", type: "read" },
  { name: "segnals_get_market_price", scope: "read:news", type: "read" },
  { name: "segnals_search_knowledge", scope: "read:knowledge", type: "read" },
  // Copy trading
  { name: "segnals_get_copy_trading", scope: "read:account", type: "read" },
  { name: "segnals_control_copy_trading", scope: "control:bots", type: "write", confirm: true },
  // Notifications
  { name: "segnals_get_notifications", scope: "manage:notifications", type: "read" },
  { name: "segnals_set_notifications", scope: "manage:notifications", type: "write" },
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
        // Add first-run guidance on auth failure
        if (result.isError) {
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
        version: "0.1.0",
        transport: "stdio",
        tools: TOOL_CATALOG,
        note: "Tools marked with scope '(any valid key)' work with any valid API key. Other tools require the listed scope to be granted to your key.",
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

export { TOOL_CATALOG, SAFETY_DISCLAIMER };
