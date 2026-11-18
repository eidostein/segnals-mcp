/**
 * Tests for several accounts in one program (SPEC 453 §4.6 cases 6 and 8), through a real MCP
 * server and client: what an agent sees, not the registration calls.
 *
 * Case 6: with a file of two labelled keys, every tool refuses a call without `account` and
 * lists both labels, and a call with `account: "b"` sends b's key and never a's.
 * Case 8: no key value appears in any tool answer, error or log line.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Accounts } from "../src/accounts.js";
import { SegnalsClient } from "../src/client.js";
import { readAccountsFile } from "../src/config.js";
import { registerAllTools } from "../src/tools/index.js";
import { TOOL_CATALOG } from "../src/tools/meta.js";

// Fake keys. The "_" inside keeps them out of secret scanners' Stripe pattern (sk_live_ + 24 alphanumerics).
const KEY_A = "sk_live_plantedkey_AAAAAAAAAAAAAAAA";
const KEY_B = "sk_test_plantedkey_BBBBBBBBBBBBBBBB";

/** Every tool but this one acts on one account; it lists them all, so `account` only filters it. */
const LISTS_ACCOUNTS = "segnals_list_accounts";
/** Tools that answer from the program itself and send no request. */
const LOCAL_TOOLS = ["segnals_get_capabilities", "segnals_get_safety_disclaimer"];

interface ToolAnswer {
  isError?: boolean;
  content: { type: string; text: string }[];
}

interface JsonSchema {
  type?: string;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

let dir: string;
let accountsPath: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "segnals-accounts-"));
  accountsPath = join(dir, "accounts.json");
  writeFileSync(
    accountsPath,
    JSON.stringify({ accounts: [{ label: "a", key: KEY_A }, { label: "b", key: KEY_B }] }),
  );
  chmodSync(accountsPath, 0o600);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A connected MCP client of a server holding the accounts of `accountsPath`. */
async function connect(accounts?: Accounts): Promise<Client> {
  const held =
    accounts ??
    Accounts.fromConfig({
      accounts: readAccountsFile(accountsPath),
      apiBase: "https://api.test.segnals.com",
      timeoutMs: 5000,
      maxRetries: 0,
    });
  const server = new McpServer({ name: "segnals-mcp", version: "test" });
  registerAllTools(server, held);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "test" });
  await client.connect(clientSide);
  return client;
}

/** A value the schema accepts. */
function sample(schema: JsonSchema): unknown {
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sample(schema.anyOf[schema.anyOf.length - 1]);
  switch (schema.type) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "x";
  }
}

/** Arguments that pass the tool's schema, with `confirm: true` so a write sends its request. */
function argumentsFor(schema: JsonSchema, account?: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const name of schema.required ?? []) {
    args[name] = sample(schema.properties?.[name] ?? {});
  }
  if (schema.properties?.confirm) args.confirm = true;
  if (account !== undefined) args.account = account;
  return args;
}

function textOf(answer: ToolAnswer): string {
  return answer.content.map((block) => block.text).join("\n");
}

describe("Several accounts", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logged: string[];

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    logged = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function headersSent(): string[] {
    return fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers.Authorization);
  }

  it("refuses every tool called without account, naming both labels, and sends nothing (case 6)", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    // The walk covers the registry: every tool the catalog names, the 33 included.
    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_CATALOG.map((tool) => tool.name).sort());
    const walked = tools.filter((tool) => tool.name !== LISTS_ACCOUNTS);
    expect(walked).toHaveLength(TOOL_CATALOG.length - 1);
    expect(walked).toHaveLength(33);

    for (const tool of walked) {
      const account = (tool.inputSchema as JsonSchema & { properties: Record<string, { description?: string }> })
        .properties.account;
      expect(account?.description, tool.name).toContain('one of "a", "b". Required');
      const answer = (await client.callTool({
        name: tool.name,
        arguments: argumentsFor(tool.inputSchema as JsonSchema),
      })) as ToolAnswer;
      expect(answer.isError, tool.name).toBe(true);
      expect(textOf(answer), tool.name).toContain('This program holds 2 accounts: "a", "b"');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an unknown label the same way, without repeating it", async () => {
    const client = await connect();

    for (const account of ["c", "A", KEY_A]) {
      const answer = (await client.callTool({ name: "segnals_list_bots", arguments: { account } })) as ToolAnswer;
      expect(answer.isError).toBe(true);
      expect(textOf(answer)).toContain('No account has that label. This program holds 2 accounts: "a", "b"');
      expect(textOf(answer)).not.toContain(KEY_A);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends b\'s key and never a\'s when a call names "b", and every answer starts with "b" (case 6)', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const sending: string[] = [];

    for (const tool of tools) {
      const before = fetchMock.mock.calls.length;
      const answer = (await client.callTool({
        name: tool.name,
        arguments: argumentsFor(tool.inputSchema as JsonSchema, "b"),
      })) as ToolAnswer;
      expect(answer.content[0].text, tool.name).toBe(tool.name === LISTS_ACCOUNTS ? "accounts: b" : "account: b");
      if (fetchMock.mock.calls.length > before) sending.push(tool.name);
    }

    // Every tool that talks to the API sent a request, so the headers below cover each of them.
    expect(sending.sort()).toEqual(
      TOOL_CATALOG.map((tool) => tool.name)
        .filter((name) => !LOCAL_TOOLS.includes(name))
        .sort(),
    );
    const headers = headersSent();
    expect(headers.length).toBeGreaterThanOrEqual(sending.length);
    expect(headers.filter((header) => header !== `Bearer ${KEY_B}`)).toEqual([]);
    expect(headers.some((header) => header.includes(KEY_A))).toBe(false);
  });

  it("keeps account optional with one account, labelled default", async () => {
    const one = new SegnalsClient({
      apiKey: KEY_A,
      apiBase: "https://api.test.segnals.com",
      timeoutMs: 5000,
      maxRetries: 0,
    });
    const client = await connect(Accounts.single(one));
    const { tools } = await client.listTools();
    const listBots = tools.find((tool) => tool.name === "segnals_list_bots");
    expect((listBots?.inputSchema as JsonSchema).required ?? []).not.toContain("account");

    const answer = (await client.callTool({ name: "segnals_list_bots", arguments: {} })) as ToolAnswer;
    expect(answer.content[0].text).toBe("account: default");
    expect(headersSent()).toEqual([`Bearer ${KEY_A}`]);
  });

  it("segnals_list_accounts shows each label and key mode, and why the fleet cannot be read", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: "not_found" }), { status: 404 }),
    );
    const client = await connect();

    const answer = (await client.callTool({ name: LISTS_ACCOUNTS, arguments: {} })) as ToolAnswer;
    expect(answer.isError ?? false).toBe(false);
    expect(answer.content[0].text).toBe("accounts: a, b");
    const data = JSON.parse(answer.content[1].text);
    expect(data.total).toBe(2);
    expect(data.accounts.map((row: { label: string; mode: string }) => [row.label, row.mode])).toEqual([
      ["a", "live"],
      ["b", "test"],
    ]);
    for (const row of data.accounts) {
      expect(row.fleet).toBeNull();
      expect(row.fleet_unavailable).toContain("GET /fleet answered 404");
    }
    // One GET /fleet per account, each with its own key.
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.test.segnals.com/fleet",
      "https://api.test.segnals.com/fleet",
    ]);
    expect(headersSent().sort()).toEqual([`Bearer ${KEY_A}`, `Bearer ${KEY_B}`].sort());
  });

  it("segnals_list_accounts passes the fleet answer through, and filters by account", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ tier: "vip", bot_limit: 100, status: "active" }), { status: 200 }),
    );
    const client = await connect();

    const answer = (await client.callTool({ name: LISTS_ACCOUNTS, arguments: { account: "b" } })) as ToolAnswer;
    expect(answer.content[0].text).toBe("accounts: b");
    expect(JSON.parse(answer.content[1].text).accounts).toEqual([
      { label: "b", mode: "test", fleet: { tier: "vip", bot_limit: 100, status: "active" } },
    ]);
    expect(headersSent()).toEqual([`Bearer ${KEY_B}`]);
  });

  it("puts no key in any answer, error or log line (case 8)", async () => {
    // The search can find what it looks for: both keys are in the config the program was given.
    const config = readFileSync(accountsPath, "utf8");
    expect(config).toContain(KEY_A);
    expect(config).toContain(KEY_B);

    const outputs: string[] = [];
    const statuses = [200, 401, 403, 404, 429, 500];
    let call = 0;
    fetchMock.mockImplementation(async () => {
      const status = statuses[call++ % statuses.length];
      return new Response(JSON.stringify({ message: `status ${status}` }), { status });
    });

    const client = await connect();
    const { tools } = await client.listTools();
    outputs.push(JSON.stringify(tools));
    for (const tool of tools) {
      const schema = tool.inputSchema as JsonSchema;
      for (const account of [undefined, "a", "b", "c", KEY_B]) {
        const answer = (await client.callTool({ name: tool.name, arguments: argumentsFor(schema, account) })) as ToolAnswer;
        outputs.push(textOf(answer));
      }
    }
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    for (const name of ["segnals_list_bots", LISTS_ACCOUNTS]) {
      outputs.push(textOf((await client.callTool({ name, arguments: { account: "a" } })) as ToolAnswer));
    }

    // The walk produced answers from the API's errors and from the refusals, and requests were sent.
    expect(outputs.length).toBeGreaterThan(tools.length * 5);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    const everything = [...outputs, ...logged].join("\n");
    expect(everything).toContain("Rate limit");
    expect(everything).toContain("This program holds 2 accounts");
    expect(everything).not.toContain(KEY_A);
    expect(everything).not.toContain(KEY_B);
    expect(everything).not.toContain("plantedkey");
  });
});
