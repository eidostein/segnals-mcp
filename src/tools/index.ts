/**
 * Tool registry — registers all tools (read-only + write/control) on the MCP server.
 *
 * Each tool module exports a `register(server, client)` function that
 * registers its tools with zod input schemas and handler functions.
 *
 * Several accounts: every module is registered once per account, bound to that account's
 * client, and the server gets each tool once, with an `account` argument that picks whose
 * copy runs. A call therefore only ever sends the key of the account it names.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SegnalsClient } from "../client.js";
import { Accounts, AccountChoiceError } from "../accounts.js";
import { accountRefusal, headed, type ToolResult } from "./helpers.js";
import { registerListAccountsTool } from "./list-accounts.js";

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

type Handler = (args: Record<string, unknown>, extra: unknown) => ToolResult | Promise<ToolResult>;

interface CapturedTool {
  description: string;
  shape: Record<string, z.ZodTypeAny>;
  handler: Handler;
}

/** Every module, registered on one server for one client. */
function registerModules(server: McpServer, client: SegnalsClient): void {
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

/** The tools the modules register for one client, in registration order. */
function captureTools(client: SegnalsClient): Map<string, CapturedTool> {
  const tools = new Map<string, CapturedTool>();
  const capture = {
    tool: (...args: unknown[]) => {
      const [name, description, shape, handler] = args;
      // Every module uses tool(name, description, shape, handler); anything else would lose
      // its arguments here, so it stops the program at start instead.
      if (
        args.length !== 4 ||
        typeof name !== "string" ||
        typeof description !== "string" ||
        typeof shape !== "object" ||
        shape === null ||
        typeof handler !== "function"
      ) {
        throw new Error(`Tool ${String(name)} is not registered as tool(name, description, shape, handler).`);
      }
      if ("account" in shape) {
        throw new Error(`Tool ${name} has its own "account" argument, which the account choice would hide.`);
      }
      tools.set(name, {
        description,
        shape: shape as Record<string, z.ZodTypeAny>,
        handler: handler as Handler,
      });
    },
  } as unknown as McpServer;
  registerModules(capture, client);
  return tools;
}

/** The `account` argument every tool takes: optional with one account, required with several. */
function accountArgument(accounts: Accounts): z.ZodOptional<z.ZodString> {
  return z
    .string()
    .optional()
    .describe(
      accounts.size === 1
        ? `The account to act on. Optional: this program holds one account, ${accounts.describeLabels()}.`
        : `The account to act on, one of ${accounts.describeLabels()}. Required: this program holds ` +
            `${accounts.size} accounts, and a call without it is refused.`,
    );
}

/**
 * Register all tools (read + write) on the MCP server.
 *
 * Given one client, it acts for one account labelled `default`.
 */
export function registerAllTools(server: McpServer, target: SegnalsClient | Accounts): void {
  const accounts = target instanceof Accounts ? target : Accounts.single(target);

  registerListAccountsTool(server, accounts);

  const copies = new Map(accounts.all.map((account) => [account.label, captureTools(account.client)]));
  const [first] = copies.values();
  for (const [name, { description, shape }] of first) {
    server.tool(
      name,
      description,
      { ...shape, account: accountArgument(accounts) },
      async ({ account, ...args }: Record<string, unknown>, extra: unknown) => {
        let label: string;
        try {
          label = accounts.pick(account).label;
        } catch (error) {
          return accountRefusal(error);
        }
        const tool = copies.get(label)?.get(name);
        if (tool === undefined) {
          return accountRefusal(new AccountChoiceError(`${name} is not registered for the account "${label}".`));
        }
        return headed(`account: ${label}`, await tool.handler(args, extra));
      },
    );
  }
}
