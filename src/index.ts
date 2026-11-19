#!/usr/bin/env node

/**
 * Segnals MCP Server — Entry Point
 *
 * Starts a stdio-based MCP server that exposes 41 tools and the resource template
 * segnals://settings/{engine} for managing Segnals trading bots, strategies, fleets and
 * portfolio via AI agents.
 *
 * Configuration is read exclusively from environment variables:
 *   - SEGNALS_API_KEY — your Segnals API key: one account, labelled "default"
 *   - SEGNALS_ACCOUNTS_FILE — instead of SEGNALS_API_KEY: a local JSON file of labelled keys,
 *     one per account, that only its owner can read (chmod 600)
 *   - SEGNALS_API_BASE (optional) — API base URL (default: https://segnals.com/api)
 *
 * Usage (the package is not on npm; these are the two ways to run it):
 *   docker run --rm -i -e SEGNALS_API_KEY ghcr.io/eidostein/segnals-mcp:latest   # GHCR image
 *   node dist/index.js                                                           # built from a clone
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAccounts } from "./config.js";
import { Accounts } from "./accounts.js";
import { registerAllTools } from "./tools/index.js";
import { registerSettingsResource } from "./resources/settings.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";

// 1. Load and validate config (exits with a friendly message if there is no key, or the accounts file is refused)
const config = loadAccounts();

// 2. Create MCP server; the instructions tell the agent to read the catalog first and apply only what the person approved
const server = new McpServer(
  {
    name: "segnals-mcp",
    version: "0.2.0",
  },
  { instructions: SERVER_INSTRUCTIONS },
);

// 3. Create one API client per account, each with its own key
const accounts = Accounts.fromConfig(config);

// 4. Register all tools; each takes `account`, which picks whose client acts
registerAllTools(server, accounts);

// 5. The settings catalog as a resource, segnals://settings/{engine}
registerSettingsResource(server, accounts);

// 6. Start stdio transport
// Structured so that Phase 4 can add Streamable HTTP transport here
// without rewriting the server/tools setup above.
const transport = new StdioServerTransport();
await server.connect(transport);
