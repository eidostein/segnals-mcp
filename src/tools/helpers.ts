/**
 * Helper to format tool responses consistently.
 *
 * All tools return structured text content via MCP's CallToolResult format.
 * The return type uses an index signature to satisfy the SDK's type requirements.
 */

import { AccountChoiceError } from "../accounts.js";
import { SegnalsApiError } from "../errors.js";

interface ToolContent {
  type: "text";
  text: string;
}

/**
 * The MCP SDK requires CallToolResult to have `[x: string]: unknown`.
 * We use a plain object type instead of an interface to satisfy this.
 */
export type ToolResult = {
  [key: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
};

/**
 * Format a successful tool result with structured JSON output.
 */
export function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * What a master key does instead of a tool whose route it may not use (SPEC 453 §3.3, §3.9): the API
 * answers such a route 403 `use_fleet_plans`, whatever the tool.
 */
export const USE_FLEET_TOOLS =
  "This account's key is a master key. It reads its own fleet and changes it only through fleet plans, so this tool " +
  "is refused for it. Use the fleet tools: segnals_get_settings_catalog and segnals_get_fleet to read, " +
  "segnals_plan_fleet to check a change (it changes nothing), segnals_apply_fleet_plan to apply a plan the person " +
  "approved, segnals_get_fleet_plan to follow it, segnals_stop_all_fleet to stop every bot of the fleet, and " +
  "segnals_fleet_report for its performance. segnals_list_bots and segnals_get_bot read the fleet's bots.";

/** The API's code for a route a master key may not use. */
export const USE_FLEET_PLANS = "use_fleet_plans";

/**
 * True for the API's 403 `use_fleet_plans`. A tool that reads something only for its preview, and
 * goes on without it when the read fails, still answers this one with err(): otherwise a master key
 * would get a preview of something it can never do. The live case is segnals_copy_strategy, whose
 * listing read is not on the master key's allow-list. The update_bot and delete_bot previews read
 * GET /bots/<id>, which is on it today, so their branch is a guard should the allow-list change.
 */
export function isUseFleetPlans(error: unknown): boolean {
  return error instanceof SegnalsApiError && error.apiError === USE_FLEET_PLANS;
}

/**
 * Format an error tool result with a clear message.
 *
 * A 403 `use_fleet_plans` (a master key on a route outside its allow-list) also names the fleet tools.
 */
export function err(error: unknown): ToolResult {
  if (error instanceof SegnalsApiError) {
    const text = isUseFleetPlans(error) ? `${error.message}\n\nWhat to do next: ${USE_FLEET_TOOLS}` : error.message;
    return {
      content: [{ type: "text" as const, text }],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * A refusal for a call that names no account where several are held, or an unknown one.
 * The message lists the labels.
 */
export function accountRefusal(error: unknown): ToolResult {
  const text = error instanceof AccountChoiceError ? error.message : "The account could not be chosen.";
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** The same answer, starting with a line that names the account it covers. */
export function headed(heading: string, result: ToolResult): ToolResult {
  return { ...result, content: [{ type: "text" as const, text: heading }, ...result.content] };
}
