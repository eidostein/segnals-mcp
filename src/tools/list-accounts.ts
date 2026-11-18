/**
 * The accounts tool — which accounts this program holds keys for.
 *
 * Tool: segnals_list_accounts
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Account, Accounts } from "../accounts.js";
import { SegnalsApiError } from "../errors.js";
import { accountRefusal, headed, ok, type ToolResult } from "./helpers.js";

/** Why GET /fleet gave nothing for an account. The error texts never carry the key. */
function fleetUnavailable(error: unknown): string {
  if (error instanceof SegnalsApiError && error.statusCode === 404) {
    return (
      "GET /fleet answered 404: the fleet manager is off on this server (FLEET_MANAGER_ENABLED), " +
      "or the server has no fleet routes yet."
    );
  }
  return error instanceof Error ? error.message : "GET /fleet failed.";
}

async function describeAccount(account: Account): Promise<Record<string, unknown>> {
  const row = { label: account.label, mode: account.client.keyMode };
  try {
    const fleet = await account.client.get<unknown>("/fleet");
    return { ...row, fleet };
  } catch (error) {
    return { ...row, fleet: null, fleet_unavailable: fleetUnavailable(error) };
  }
}

export function registerListAccountsTool(server: McpServer, accounts: Accounts): void {
  server.tool(
    "segnals_list_accounts",
    `List the Segnals accounts this program holds keys for: each account's label, its key's mode ("live" or "test", read from the key's prefix; the key itself is never shown), and what GET /fleet answers for it (tier, bot limit, fleet status), or why it cannot. Every other tool takes one of these labels as its account argument; with several accounts it is required. Use this first when you do not know the labels. Requires: no scope for the labels and modes (they are read locally); the fleet answer needs a master key. Example: segnals_list_accounts()`,
    {
      account: z
        .string()
        .optional()
        .describe("Only this account. Leave it out to list every account."),
    },
    async ({ account }): Promise<ToolResult> => {
      let chosen: Account[];
      try {
        chosen = account === undefined ? accounts.all : [accounts.pick(account)];
      } catch (error) {
        return accountRefusal(error);
      }
      const rows = await Promise.all(chosen.map(describeAccount));
      const labels = chosen.map((one) => one.label).join(", ");
      return headed(`accounts: ${labels}`, ok({ total: rows.length, accounts: rows }));
    },
  );
}
