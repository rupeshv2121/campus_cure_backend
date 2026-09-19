#!/usr/bin/env node
/**
 * Dependency audit gate for CI.
 *
 * Why this exists instead of plain `npm audit --audit-level=high`:
 *
 * Four high-severity advisories are permanently open against the `prisma` CLI
 * and its transitive dependencies. They are unreachable in our usage and never
 * reach the deployed lambda, and npm's only proposed remedy is a major
 * downgrade to Prisma 6 that would break the schema. See
 * docs/adr/0003-stay-on-prisma-7.md for the full reasoning.
 *
 * `npm audit --omit=dev` does NOT exclude them — it still reports all four and
 * exits 1. A permanently red build teaches everyone to ignore CI, which is
 * worse than no check at all.
 *
 * So: fail on any high/critical advisory that is NOT explicitly accepted below.
 * The allowlist is small, named, and reviewable — a new vulnerability in
 * anything we ship still breaks the build.
 */
import { execSync } from "node:child_process";

/**
 * Accepted advisories, by package name. Every entry needs a reason and a
 * condition under which it should be removed.
 */
const ACCEPTED = new Map([
  ["prisma", "ADR-0003: CLI devDependency, not shipped. Fixed by Prisma 8."],
  ["@prisma/config", "ADR-0003: reached only via the prisma CLI."],
  ["deepmerge-ts", "ADR-0003: via @prisma/config; merges our own config file."],
  ["mysql2", "ADR-0003: via the prisma CLI. We use PostgreSQL; never invoked."],
  ["esbuild", "Dev-server-only advisory, reached via tsx. Never served."],
]);

const FAIL_ON = new Set(["high", "critical"]);

let raw;
try {
  // A fixed command string with no interpolated input. execSync keeps this
  // portable across platforms (Node 24 refuses to spawn npm.cmd without a
  // shell on Windows) without the args-through-a-shell deprecation.
  raw = execSync("npm audit --json", {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch (err) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  raw = err.stdout;
  if (!raw) {
    console.error("Could not run npm audit:", err.message);
    process.exit(1);
  }
}

const report = JSON.parse(raw);
const vulnerabilities = Object.values(report.vulnerabilities ?? {});

const blocking = [];
const accepted = [];

for (const vuln of vulnerabilities) {
  if (!FAIL_ON.has(vuln.severity)) continue;
  if (ACCEPTED.has(vuln.name)) accepted.push(vuln);
  else blocking.push(vuln);
}

if (accepted.length > 0) {
  console.log("Accepted advisories (see docs/adr/0003-stay-on-prisma-7.md):");
  for (const vuln of accepted) {
    console.log(`  - ${vuln.name} (${vuln.severity}): ${ACCEPTED.get(vuln.name)}`);
  }
  console.log("");
}

// Keep the allowlist honest: flag entries that no longer match anything, so it
// gets pruned rather than quietly growing stale and hiding a real problem.
const seen = new Set(vulnerabilities.map((v) => v.name));
const stale = [...ACCEPTED.keys()].filter((name) => !seen.has(name));
if (stale.length > 0) {
  console.log(
    `Note: these allowlist entries no longer report advisories and can be removed: ${stale.join(", ")}\n`,
  );
}

if (blocking.length > 0) {
  console.error("BLOCKING: new high/critical advisories not on the allowlist:\n");
  for (const vuln of blocking) {
    const title =
      vuln.via?.find?.((v) => typeof v === "object")?.title ?? "(transitive)";
    console.error(`  - ${vuln.name} (${vuln.severity}): ${title}`);
    console.error(`    range: ${vuln.range}`);
  }
  console.error(
    "\nFix it, or add it to the allowlist in scripts/audit-check.mjs with a" +
      "\nwritten justification and an ADR if the reasoning is non-obvious.",
  );
  process.exit(1);
}

console.log(
  `Audit gate passed: ${accepted.length} accepted, 0 unreviewed high/critical advisories.`,
);
