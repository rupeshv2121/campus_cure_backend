/**
 * Global test setup. Runs before any test file is evaluated.
 *
 * Two jobs:
 *  1. Refuse to run if the environment points at the production database.
 *  2. Provide the environment variables `src/config/env.ts` demands, so that
 *     importing the app under test does not abort.
 */

// Capture what the shell/CI actually handed us BEFORE we overwrite anything.
const inheritedDatabaseUrl = process.env.DATABASE_URL;

/**
 * Hosts that must never be written to by a test run. `supabase.com` is the
 * production database; `pooler.supabase.com` is the same instance via PgBouncer.
 */
const PRODUCTION_HOST_PATTERN = /supabase\.com/i;

if (
  !process.env.TEST_DATABASE_URL &&
  inheritedDatabaseUrl &&
  PRODUCTION_HOST_PATTERN.test(inheritedDatabaseUrl)
) {
  throw new Error(
    [
      "",
      "REFUSING TO RUN TESTS.",
      "",
      "DATABASE_URL points at what looks like the production database, and",
      "TEST_DATABASE_URL is not set. A test run against production could create",
      "or destroy real records.",
      "",
      "Either unset DATABASE_URL for this run, or set TEST_DATABASE_URL to a",
      "throwaway database (see docs/specs/CC-04-test-harness.md).",
      "",
    ].join("\n"),
  );
}

// Deliberately not a real host. Tier 1 mocks the Prisma client entirely, so
// nothing should ever dial this; if something tries, it fails loudly and fast
// rather than silently reaching a real server.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://test:test@127.0.0.1:1/campuscure_test";

// 48 chars, comfortably over the 32-char minimum env.ts enforces.
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-secret-not-used-anywhere-real-0123456789abc";

process.env.NODE_ENV = "test";

/** Exposed so tests sign tokens with the same secret the app verifies with. */
export const TEST_JWT_SECRET = process.env.JWT_SECRET;

/** True when Tier 2 (real database) tests should run. */
export const HAS_TEST_DATABASE = Boolean(process.env.TEST_DATABASE_URL);
