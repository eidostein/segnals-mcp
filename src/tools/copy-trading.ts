/**
 * Copy trading tools — view and control copy trading.
 *
 * Tools: segnals_get_copy_trading, segnals_control_copy_trading ✋
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";

export function registerCopyTradingTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_copy_trading ──
  server.tool(
    "segnals_get_copy_trading",
    `Get your copy trading configuration and status. Shows which exchanges have copy trading enabled, the current settings, and operational status. Copy trading is a VIP feature. Requires scope: read:account. Example: segnals_get_copy_trading()`,
    {},
    async () => {
      try {
        const data = await client.get<Record<string, unknown>>("/copy-trading/");
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_control_copy_trading ✋ ──
  server.tool(
    "segnals_control_copy_trading",
    `Start or stop copy trading for an exchange. Requires scope: control:bots. VIP tier required.

TWO-STEP CONFIRMATION: Call without confirm to preview. Call with confirm: true to execute.
Copy trading mirrors trades from source accounts to destination accounts on the same exchange.`,
    {
      action: z.enum(["start", "stop"]).describe("Action: start or stop copy trading"),
      exchange: z.enum(["bybit", "phemex"]).describe("Exchange to control copy trading for"),
      confirm: z.boolean().optional().default(false).describe("Set to true to execute after previewing"),
    },
    async ({ action, exchange, confirm }) => {
      try {
        if (!confirm) {
          return ok({
            action: "control_copy_trading",
            preview: `Will ${action} copy trading for ${exchange.toUpperCase()}. ` +
              (action === "start"
                ? "This will begin mirroring trades from source accounts to destination accounts. " +
                  "Make sure your source and destination accounts are properly configured."
                : "This will stop mirroring trades. Existing positions will NOT be closed automatically."),
            exchange,
            requested_action: action,
            instruction: "To proceed, call segnals_control_copy_trading again with confirm: true",
          });
        }

        const result = await client.post<{ status: string; msg: string }>(
          "/copy-trading/control",
          { action, exchange, client: "mcp" },
        );

        return ok({
          action: "control_copy_trading",
          executed: true,
          exchange,
          status: result.status,
          message: result.msg,
        });
      } catch (error) {
        return err(error);
      }
    },
  );
}
