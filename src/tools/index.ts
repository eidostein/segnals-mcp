/**
 * Tool registry — registers all tools (read-only + write/control) on the MCP server.
 *
 * Each tool module exports a `register(server, client)` function that
 * registers its tools with zod input schemas and handler functions.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";

// Read-only tools
import { registerMetaTools } from "./meta.js";
import { registerAccountTools } from "./account.js";
import { registerStatsTools } from "./stats.js";
import { registerBotsTools } from "./bots.js";
import { registerMarketplaceTools } from "./marketplace.js";
import { registerNewsTools } from "./news.js";
import { registerCopyTradingTools } from "./copy-trading.js";
import { registerNotificationTools } from "./notifications.js";

// Write/control tools (Phase 3)
import { registerWriteBotTools } from "./write-bots.js";
import { registerWriteStrategyTools } from "./write-strategies.js";
import { registerWriteMarketplaceTools } from "./write-marketplace.js";

/**
 * Register all tools (read + write) on the MCP server.
 */
export function registerAllTools(server: McpServer, client: SegnalsClient): void {
  // Read-only tools
  registerMetaTools(server, client);
  registerAccountTools(server, client);
  registerStatsTools(server, client);
  registerBotsTools(server, client);
  registerMarketplaceTools(server, client);
  registerNewsTools(server, client);
  registerCopyTradingTools(server, client);
  registerNotificationTools(server, client);

  // Write/control tools (Phase 3)
  registerWriteBotTools(server, client);
  registerWriteStrategyTools(server, client);
  registerWriteMarketplaceTools(server, client);
}
