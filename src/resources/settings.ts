/**
 * The settings catalog as an MCP resource (SPEC 453 §3.9): `segnals://settings/{engine}`.
 *
 * It lists one resource per engine and reads the API's catalog for it (`GET /settings/catalog`),
 * the same JSON segnals_get_settings_catalog answers. The catalog is the same for every key on a
 * server and holds no account data, and a resource read names no account, so it is read with the
 * first account the program holds. The tool takes `account` for a read with another key.
 */

import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Accounts } from "../accounts.js";
import { ENGINES, type Engine } from "../tools/fleet.js";

export const SETTINGS_URI_TEMPLATE = "segnals://settings/{engine}";

const MIME = "application/json";

function uriOf(engine: Engine): string {
  return `segnals://settings/${engine}`;
}

function isEngine(value: unknown): value is Engine {
  return typeof value === "string" && (ENGINES as readonly string[]).includes(value);
}

export function registerSettingsResource(server: McpServer, accounts: Accounts): void {
  const [reader] = accounts.all;

  server.registerResource(
    "settings-catalog",
    new ResourceTemplate(SETTINGS_URI_TEMPLATE, {
      list: async () => ({
        resources: ENGINES.map((engine) => ({
          uri: uriOf(engine),
          name: `settings-${engine}`,
          title: `Segnals ${engine} settings catalog`,
          description: `Every setting of the ${engine} engine: path, type, unit, range, default, meaning, money flag, key_may_change.`,
          mimeType: MIME,
        })),
      }),
      complete: {
        engine: (value) => ENGINES.filter((engine) => engine.startsWith(value)),
      },
    }),
    {
      title: "Segnals settings catalog",
      description:
        "Every setting of one engine (mt5, bybit, phemex, grid), as GET /settings/catalog answers it. " +
        "Read it before planning or changing any bot setting. Read with the program's first account; " +
        "segnals_get_settings_catalog takes an account argument.",
      mimeType: MIME,
    },
    async (uri, variables) => {
      const engine = variables.engine;
      if (!isEngine(engine)) {
        throw new Error(`There is no settings catalog for that engine. The engines are ${ENGINES.join(", ")}.`);
      }
      let catalog: unknown;
      try {
        catalog = await reader.client.get<unknown>("/settings/catalog", { engine });
      } catch (error) {
        const why = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${why} The resource reads with the account "${reader.label}"; ` +
            "segnals_get_settings_catalog reads with the account you name.",
        );
      }
      return {
        contents: [{ uri: uri.href, mimeType: MIME, text: JSON.stringify(catalog), _meta: { account: reader.label } }],
      };
    },
  );
}
