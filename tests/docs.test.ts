/**
 * Tests for the documentation: the install paths, addresses and tools it names must be
 * the ones that exist.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOOL_CATALOG } from "../src/tools/meta.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function read(path: string): string {
  return readFileSync(`${ROOT}${path}`, "utf8");
}

const CHANGELOG = "docs/CHANGELOG.md";

/** Everything a user or an agent reads. */
const DOCS = [
  "README.md",
  "AGENTS.md",
  "llms.txt",
  ...readdirSync(`${ROOT}docs`)
    .filter((file) => file.endsWith(".md"))
    .map((file) => `docs/${file}`),
];

/** Docs plus the shipped files that carry usage text. */
const USER_FACING = [...DOCS, "src/index.ts", "src/config.ts", "Dockerfile"];

/** The changelog keeps the history of earlier releases, so current-state rules skip it. */
const CURRENT_DOCS = DOCS.filter((path) => path !== CHANGELOG);

function filesMatching(paths: string[], pattern: RegExp): string[] {
  return paths.filter((path) => pattern.test(read(path)));
}

function filesLacking(paths: string[], needle: string): string[] {
  return paths.filter((path) => !read(path).includes(needle));
}

describe("Docs", () => {
  it("names test.segnals.com as the staging address and says what staging is", () => {
    const stagingDocs = [
      "docs/GETTING_STARTED.md",
      "docs/CONFIGURATION.md",
      "docs/AUTHENTICATION.md",
      "docs/TROUBLESHOOTING.md",
    ];

    expect(filesMatching(USER_FACING, /staging\.segnals/)).toEqual([]);
    expect(filesLacking(stagingDocs, "SEGNALS_API_BASE=https://test.segnals.com/api")).toEqual([]);
    expect(filesLacking(stagingDocs, "Staging needs its own API key")).toEqual([]);
    expect(filesLacking(stagingDocs, "it is not all demo")).toEqual([]);
  });

  it("gives only the install paths that exist: the GHCR image and a build from source", () => {
    const installDocs = [
      "README.md",
      "AGENTS.md",
      "llms.txt",
      "docs/GETTING_STARTED.md",
      "docs/CONFIGURATION.md",
    ];

    // Not on npm, and the image and repository live under eidostein.
    expect(filesMatching(USER_FACING, /\bnpx\b/)).toEqual([]);
    expect(filesMatching(USER_FACING, /npm (?:install|i) (?:-g|--global)/)).toEqual([]);
    expect(filesMatching(USER_FACING, /ghcr\.io\/segnals\//)).toEqual([]);
    expect(filesMatching(USER_FACING, /github\.com\/segnals\//)).toEqual([]);

    expect(filesLacking(installDocs, "ghcr.io/eidostein/segnals-mcp")).toEqual([]);
    expect(filesLacking(installDocs, "npm run build")).toEqual([]);
    expect(filesLacking(installDocs, "not published to npm")).toEqual([]);
    expect(read("src/index.ts")).toContain("ghcr.io/eidostein/segnals-mcp");
    expect(read("src/index.ts")).toContain("node dist/index.js");

    // The container needs stdin open and the key passed in, or the client sees nothing.
    const lines = USER_FACING.flatMap((path) =>
      read(path)
        .split("\n")
        .map((line) => ({ path, line })),
    );
    const commands = lines.filter(({ line }) => /docker run -/.test(line));
    const configs = lines.filter(({ line }) => /"args": \["run",/.test(line));
    expect(commands.length).toBeGreaterThan(0);
    expect(configs.length).toBeGreaterThan(0);
    expect(commands.filter(({ line }) => !line.includes(" -i -e SEGNALS_API_KEY "))).toEqual([]);
    expect(configs.filter(({ line }) => !line.includes('"-i", "-e", "SEGNALS_API_KEY",'))).toEqual([]);
  });

  it("states the tool count the server has", () => {
    const stated = /\b(\d+)\s+(?:distinct\s+)?tools\b|\((\d+)\s+total\)/g;
    const counts = CURRENT_DOCS.flatMap((path) =>
      [...read(path).matchAll(stated)].map((match) => ({
        path,
        count: Number(match[1] ?? match[2]),
      })),
    );

    const stating = counts.map(({ path }) => path);
    const mustState = ["README.md", "AGENTS.md", "llms.txt", "docs/TOOLS.md"];
    expect(mustState.filter((path) => !stating.includes(path))).toEqual([]);
    expect(counts.filter(({ count }) => count !== TOOL_CATALOG.length)).toEqual([]);
    expect(read("src/index.ts")).toContain(`${TOOL_CATALOG.length} tools`);
  });

  it("lists exactly the tools the server has, with no placeholder", () => {
    const names = TOOL_CATALOG.map((tool) => tool.name).sort();

    for (const path of ["README.md", "AGENTS.md", "docs/TOOLS.md"]) {
      const named = [...new Set(read(path).match(/segnals_[a-z_]+/g) ?? [])].sort();
      expect(named, path).toEqual(names);
    }
    expect(filesMatching(DOCS, /coming\s+soon/i)).toEqual([]);
    expect(read("README.md")).toContain("The `read:knowledge` scope has no tool yet");
  });

  it("gives each tool the scope and confirmation step the server gives it", () => {
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
    const rows = read("README.md")
      .split("\n")
      .filter((line) => line.startsWith("| `segnals_"))
      .map((line) => line.split("|").map((cell) => cell.trim().replaceAll("`", "")))
      .map((cells) => ({ name: cells[1], scope: cells[4], confirm: cells[5].includes("Yes") }));

    expect(rows.sort(byName)).toEqual(
      TOOL_CATALOG.map((tool) => ({
        name: tool.name,
        scope: tool.scope.replace(/[()]/g, ""),
        confirm: "confirm" in tool && tool.confirm === true,
      })).sort(byName),
    );
  });
});
