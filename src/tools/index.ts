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
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
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
import { registerNotificationTools } from "./notifications.js";

// Write/control tools (Phase 3)
import { registerWriteBotTools } from "./write-bots.js";
import { registerWriteStrategyTools } from "./write-strategies.js";
import { registerWriteMarketplaceTools } from "./write-marketplace.js";

// Fleet reads (SPEC 453): the settings catalog, the fleet and its report
import { registerFleetTools } from "./fleet.js";
// Fleet plans (SPEC 453): check, read, apply, stop all
import { registerFleetPlanTools } from "./fleet-plans.js";

export type Handler = (args: Record<string, unknown>, extra: unknown) => ToolResult | Promise<ToolResult>;

export interface CapturedTool {
  description: string;
  shape: Record<string, z.ZodType>;
  /** readOnlyHint / destructiveHint, when the module gave them. */
  annotations?: ToolAnnotations;
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
  registerNotificationTools(server, client);

  // Write/control tools (Phase 3)
  registerWriteBotTools(server, client);
  registerWriteStrategyTools(server, client);
  registerWriteMarketplaceTools(server, client);

  // Fleet reads (SPEC 453)
  registerFleetTools(server, client);

  // Fleet plans (SPEC 453)
  registerFleetPlanTools(server, client);
}

/**
 * The tools the modules register for one client, in registration order.
 *
 * @throws when a tool is registered in another form than tool(name, description, shape, handler)
 *   or tool(name, description, shape, annotations, handler), or has an `account` argument of its
 *   own. Both would break the account choice, so they stop the program at start.
 */
export function captureTools(
  client: SegnalsClient,
  register: (server: McpServer, client: SegnalsClient) => void = registerModules,
): Map<string, CapturedTool> {
  const tools = new Map<string, CapturedTool>();
  const capture = {
    tool: (...args: unknown[]) => {
      // Every module uses tool(name, description, shape, handler), or the same with the
      // annotations before the handler. Another form would be read wrongly here, so it stops the
      // program at start instead.
      const [name, description, shape] = args;
      const annotations = args.length === 5 ? args[3] : undefined;
      const handler = args[args.length - 1];
      if (
        (args.length !== 4 && args.length !== 5) ||
        typeof name !== "string" ||
        typeof description !== "string" ||
        typeof shape !== "object" ||
        shape === null ||
        (args.length === 5 && (typeof annotations !== "object" || annotations === null)) ||
        typeof handler !== "function"
      ) {
        throw new Error(
          `Tool ${String(name)} is not registered as tool(name, description, shape, [annotations,] handler).`,
        );
      }
      if ("account" in shape) {
        throw new Error(`Tool ${name} has its own "account" argument, which the account choice would hide.`);
      }
      tools.set(name, {
        description,
        shape: shape as Record<string, z.ZodType>,
        ...(annotations === undefined ? {} : { annotations: annotations as ToolAnnotations }),
        handler: handler as Handler,
      });
    },
  } as unknown as McpServer;
  register(capture, client);
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
  for (const [name, { description, shape, annotations }] of first) {
    const schema = { ...shape, account: accountArgument(accounts) };
    const handler = async ({ account, ...args }: Record<string, unknown>, extra: unknown) => {
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
    };
    if (annotations === undefined) {
      server.tool(name, description, schema, handler);
    } else {
      server.tool(name, description, schema, annotations, handler);
    }
  }
}
