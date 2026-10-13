/**
 * News tools — the market newsfeed.
 *
 * Tools: segnals_get_news
 *
 * Sentiment, live prices and knowledge search are not here: the API has no route for
 * them yet, and a tool is only listed once it returns data.
 */

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
        // The blueprint is mounted at /api/newsfeed and its own route is /newsfeed.
        const data = await client.get<Record<string, unknown>>("/newsfeed/newsfeed");
        return ok(data);
      } catch (error) {
        return err(error);
      }
    },
  );
}
