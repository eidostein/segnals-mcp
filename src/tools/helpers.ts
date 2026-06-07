/**
 * Helper to format tool responses consistently.
 *
 * All tools return structured text content via MCP's CallToolResult format.
 * The return type uses an index signature to satisfy the SDK's type requirements.
 */

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
 * Format an error tool result with a clear message.
 */
export function err(error: unknown): ToolResult {
  if (error instanceof SegnalsApiError) {
    return {
      content: [{ type: "text" as const, text: error.message }],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
