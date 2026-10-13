/**
 * Tests for the release: a version tag publishes the Docker image and nothing to npm,
 * and the version is one number everywhere it is written.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function read(path: string): string {
  return readFileSync(`${ROOT}${path}`, "utf8");
}

/** The lines of one job in ci.yml, read as text: the project has no YAML parser. */
function jobLines(job: string): string[] {
  const lines = read(".github/workflows/ci.yml").split("\n");
  const start = lines.indexOf(`  ${job}:`);
  if (start === -1) return [];
  const length = lines.slice(start + 1).findIndex((line) => /^ {2}\S/.test(line));
  return lines.slice(start, length === -1 ? undefined : start + 1 + length);
}

function jobCondition(job: string): string | undefined {
  return jobLines(job)
    .map((line) => /^ {4}if: (.+)$/.exec(line)?.[1])
    .find((condition) => condition !== undefined);
}

function firstMatch(path: string, pattern: RegExp): string | undefined {
  return pattern.exec(read(path))?.[1];
}

describe("Release", () => {
  it("publishes to npm only when the repository variable NPM_PUBLISH_ENABLED is true", () => {
    const onTag = "startsWith(github.ref, 'refs/tags/v')";

    expect(jobCondition("publish-npm")).toBe(`${onTag} && vars.NPM_PUBLISH_ENABLED == 'true'`);
    expect(jobCondition("publish-docker")).toBe(onTag);

    // No other job publishes the package.
    const jobs = ["lint-typecheck", "test", "build-smoke", "audit", "publish-npm", "publish-docker"];
    const publishing = jobs.filter((job) => jobLines(job).some((line) => /npm publish/.test(line)));
    expect(publishing).toEqual(["publish-npm"]);
    expect(read(".github/workflows/ci.yml").match(/npm publish/g)).toHaveLength(1);
  });

  it("names one version everywhere", () => {
    const version = (JSON.parse(read("package.json")) as { version: string }).version;
    const lock = JSON.parse(read("package-lock.json")) as {
      version: string;
      packages: Record<string, { version: string }>;
    };

    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect({
      lock: lock.version,
      lockRoot: lock.packages[""].version,
      server: firstMatch("src/index.ts", /version: "([^"]+)"/),
      capabilities: firstMatch("src/tools/meta.ts", /version: "([^"]+)"/),
      imageLabel: firstMatch("Dockerfile", /org\.opencontainers\.image\.version="([^"]+)"/),
      changelog: firstMatch("docs/CHANGELOG.md", /^## \[(\d+\.\d+\.\d+)\]/m),
    }).toEqual({
      lock: version,
      lockRoot: version,
      server: version,
      capabilities: version,
      imageLabel: version,
      changelog: version,
    });
  });
});
