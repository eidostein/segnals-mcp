#!/usr/bin/env node

/**
 * Segnals MCP Server — Entry Point
 *
 * Starts a stdio-based MCP server that exposes 33 tools for managing
 * Segnals trading bots, strategies, and portfolio via AI agents.
 *
 * Configuration is read exclusively from environment variables:
 *   - SEGNALS_API_KEY (required) — your Segnals API key
 *   - SEGNALS_API_BASE (optional) — API base URL (default: https://segnals.com/api)
 *
 * Usage (the package is not on npm; these are the two ways to run it):
 *   docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest   # GHCR image
 *   node dist/index.js                                                           # built from a clone
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
  version: "0.1.1",
});

// 3. Create API client
const client = new SegnalsClient(config);

// 4. Register all tools
registerAllTools(server, client);

// 5. Start stdio transport
// Structured so that Phase 4 can add Streamable HTTP transport here
// without rewriting the server/tools setup above.
const transport = new StdioServerTransport();
await server.connect(transport);
