/**
 * CC-01 regression: the process must refuse to start on a missing or weak
 * JWT_SECRET rather than silently signing tokens with something forgeable.
 *
 * `config/env.ts` validates at import time, so each case re-imports the module
 * with a fresh registry.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "a".repeat(32);
const VALID_DB = "postgresql://user:pass@localhost:5432/db";

const originalEnv = { ...process.env };

/** Import config/env.ts fresh under a specific environment. */
const loadEnv = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) process.env[key] = value;
  }
  return import("../../config/env.js");
};

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("config/env.ts validation", () => {
  it("accepts a 32-character secret", async () => {
    const env = await loadEnv({
      DATABASE_URL: VALID_DB,
      JWT_SECRET: VALID_SECRET,
    });
    expect(env.JWT_SECRET).toBe(VALID_SECRET);
    expect(env.DATABASE_URL).toBe(VALID_DB);
  });

  it("refuses to start when JWT_SECRET is missing", async () => {
    await expect(loadEnv({ DATABASE_URL: VALID_DB })).rejects.toThrow(
      /JWT_SECRET is not set/i,
    );
  });

  it("refuses to start when DATABASE_URL is missing", async () => {
    await expect(loadEnv({ JWT_SECRET: VALID_SECRET })).rejects.toThrow(
      /DATABASE_URL is not set/i,
    );
  });

  it.each([
    ["10 characters", "a".repeat(10)],
    ["31 characters — one short of the minimum", "a".repeat(31)],
  ])("refuses a secret of %s", async (_label, secret) => {
    await expect(
      loadEnv({ DATABASE_URL: VALID_DB, JWT_SECRET: secret }),
    ).rejects.toThrow(/at least 32 characters/i);
  });

  it("refuses a whitespace-only secret", async () => {
    await expect(
      loadEnv({ DATABASE_URL: VALID_DB, JWT_SECRET: "   " }),
    ).rejects.toThrow(/not set/i);
  });

  /**
   * The point of this one: the value is 64 characters and passes every length
   * and entropy check. Length was never the property that mattered — secrecy
   * was — and a warning in a chat log is not a control.
   */
  it("refuses a long secret that is known to have leaked", async () => {
    await expect(
      loadEnv({
        DATABASE_URL: VALID_DB,
        JWT_SECRET:
          "zW/FE2Cgc6xii2zshC9QmQaoYQxN+eN/HEUY+ixCVcNueKOCR838jokX3nVcufhV",
      }),
    ).rejects.toThrow(/known to have leaked/i);
  });

  it("still accepts a fresh secret of the same length", async () => {
    const fresh = Buffer.from(
      Array.from({ length: 48 }, (_, i) => (i * 37 + 11) % 256),
    ).toString("base64");
    const env = await loadEnv({ DATABASE_URL: VALID_DB, JWT_SECRET: fresh });
    expect(env.JWT_SECRET).toBe(fresh);
  });

  it("refuses the default secret that was once committed to the repo", async () => {
    await expect(
      loadEnv({
        DATABASE_URL: VALID_DB,
        JWT_SECRET: "your-secret-key-change-in-production",
      }),
    ).rejects.toThrow(/known default/i);
  });
});
