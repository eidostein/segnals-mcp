#!/usr/bin/env node

/**
 * Segnals MCP Server — Entry Point
 *
 * Starts a stdio-based MCP server that exposes 36 tools for managing
 * Segnals trading bots, strategies, and portfolio via AI agents.
 *
 * Configuration is read exclusively from environment variables:
 *   - SEGNALS_API_KEY (required) — your Segnals API key
 *   - SEGNALS_API_BASE (optional) — API base URL (default: https://segnals.com/api)
 *
 * Usage:
 *   npx @segnals/mcp                    # via npx
 *   node dist/index.js                  # from clone
 *   SEGNALS_API_KEY=sk_live_... npx @segnals/mcp  # inline key
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { SegnalsClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

// 1. Load and validate config (exits with friendly message if no key)
const config = loadConfig();

// 2. Create MCP server
const server = new McpServer({
  name: "segnals-mcp",
  version: "0.1.0",
});

// 3. Create API client
const client = new SegnalsClient(config);

// 4. Register all read-only tools
registerAllTools(server, client);

// 5. Start stdio transport
// Structured so that Phase 4 can add Streamable HTTP transport here
// without rewriting the server/tools setup above.
const transport = new StdioServerTransport();
await server.connect(transport);
