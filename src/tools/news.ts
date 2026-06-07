/**
 * News & knowledge tools — newsfeed, sentiment, market prices, knowledge search.
 *
 * Tools: segnals_get_news, segnals_get_sentiment, segnals_get_market_price, segnals_search_knowledge
 *
 * NOTE: segnals_get_sentiment, segnals_get_market_price, and segnals_search_knowledge
 * are currently stubbed — the REST endpoints do not yet exist. They return a clear
 * message pointing to the future Phase 4 implementation.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { ok, err } from "./helpers.js";

export function registerNewsTools(server: McpServer, client: SegnalsClient): void {
  // ── segnals_get_news ──
  server.tool(
    "segnals_get_news",
    `Get the latest market news and events from the Segnals newsfeed. Use this to stay informed about market-moving events that may affect trading strategies. Requires scope: read:news. Example: segnals_get_news()`,
    {},
    async () => {
      try {
        const data = await client.get<Record<string, unknown>>("/newsfeed");
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );

  // ── segnals_get_sentiment ── (STUB)
  server.tool(
    "segnals_get_sentiment",
    `Get market sentiment data for a specific coin or trading symbol. Shows bullish/bearish sentiment indicators. NOTE: This tool is coming soon — the endpoint is not yet available. Requires scope: read:news. Example: segnals_get_sentiment({ symbol: "BTCUSDT" })`,
    {
      symbol: z.string().describe("The trading symbol to get sentiment for (e.g., 'BTCUSDT')"),
    },
    async ({ symbol: _symbol }) => {
      // TODO(Phase 4): Connect to sentiment endpoint when available
      return ok({
        status: "coming_soon",
        message:
          "Sentiment analysis is coming in a future update. " +
          "For now, use segnals_get_news() to stay informed about market events.",
      });
    },
  );

  // ── segnals_get_market_price ── (STUB)
  server.tool(
    "segnals_get_market_price",
    `Get the current live price for a trading symbol. NOTE: This tool is coming soon — the endpoint is not yet available. Requires scope: read:news. Example: segnals_get_market_price({ symbol: "BTCUSDT" })`,
    {
      symbol: z.string().describe("The trading symbol to get the price for (e.g., 'BTCUSDT')"),
    },
    async ({ symbol: _symbol }) => {
      // TODO(Phase 4): Connect to market price endpoint when available
      return ok({
        status: "coming_soon",
        message:
          "Live market prices are coming in a future update. " +
          "For now, check exchange prices directly or use segnals_get_dashboard() for portfolio value.",
      });
    },
  );

  // ── segnals_search_knowledge ── (STUB)
  server.tool(
    "segnals_search_knowledge",
    `Search the Segnals knowledge base for help articles, feature documentation, and trading guides. Uses semantic search to find relevant content. NOTE: This tool is coming soon — the endpoint is not yet available. Requires scope: read:knowledge. Example: segnals_search_knowledge({ query: "how to set up trailing stop" })`,
    {
      query: z.string().describe("The search query for the knowledge base"),
    },
    async ({ query: _query }) => {
      // TODO(Phase 4): Connect to pgvector knowledge search endpoint when available
      return ok({
        status: "coming_soon",
        message:
          "Knowledge base search is coming in a future update. " +
          "For now, visit https://segnals.com/docs for documentation and guides.",
      });
    },
  );
}
