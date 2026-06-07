/**
 * Marketplace tools — browse, get listing details, view own listings.
 *
 * Tools: segnals_browse_marketplace, segnals_get_listing, segnals_my_listings
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";

export function registerMarketplaceTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_browse_marketplace ──
  server.tool(
    "segnals_browse_marketplace",
    `Browse the Segnals strategy marketplace. Returns available strategy listings with performance data (clearly labeled as live or backtest). Results are neutrally sorted. Use this to discover strategies the user can copy. Requires scope: read:marketplace. Example: segnals_browse_marketplace({ page: 1 })`,
    {
      page: z.number().int().min(1).optional().describe("Page number (default 1)"),
      per_page: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Results per page (default 20, max 50)"),
      exchange: z
        .string()
        .optional()
        .describe("Filter by exchange (e.g., 'bybit', 'mt5')"),
    },
    async ({ page, per_page, exchange }) => {
      try {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (page !== undefined) params.page = page;
        if (per_page !== undefined) params.per_page = per_page;
        if (exchange !== undefined) params.exchange = exchange;

        const data = await client.get<Record<string, unknown>>("/marketplace", params);
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_listing ──
  server.tool(
    "segnals_get_listing",
    `Get details for a specific marketplace listing, including the strategy configuration preview and performance report. Use this to evaluate a strategy before copying it. Requires scope: read:marketplace. Example: segnals_get_listing({ listing_id: "abc123" })`,
    {
      listing_id: z
        .union([z.string(), z.number()])
        .describe("The ID of the marketplace listing to retrieve"),
    },
    async ({ listing_id }) => {
      try {
        const data = await client.get<Record<string, unknown>>(`/marketplace/${listing_id}`);
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_my_listings ──
  server.tool(
    "segnals_my_listings",
    `View your own marketplace listings and sales data (VIP sellers). Shows your published strategies, sale counts, and earnings. Use this to manage your marketplace presence. Requires scope: read:marketplace. Example: segnals_my_listings()`,
    {},
    async () => {
      try {
        const data = await client.get<Record<string, unknown>>("/marketplace/me/sales");
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );
}
