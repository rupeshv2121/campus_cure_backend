/**
 * Environment configuration with fail-fast validation.
 *
 * This module validates at import time, before the server accepts a request.
 * A missing or weak secret must stop the process rather than silently degrade
 * authentication — see docs/specs/CC-01-security-baseline.md.
 */

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Secrets that have been present in source control at some point. Even if one
 * is later set explicitly via the environment, it must never be accepted: it is
 * public, so any token signed with it is forgeable by anyone who can read the
 * repository.
 */
const BANNED_SECRETS = new Set(["your-secret-key-change-in-production"]);

const fatal = (message: string): never => {
  throw new Error(`FATAL: ${message} Refusing to start.`);
};

const required = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    fatal(`required environment variable ${key} is not set.`);
  }
  return value as string;
};

const readJwtSecret = (): string => {
  const secret = required("JWT_SECRET");

  if (BANNED_SECRETS.has(secret)) {
    fatal(
      "JWT_SECRET is set to a known default that has appeared in source control. " +
        "Generate a new one: openssl rand -base64 48",
    );
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    fatal(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
        `(got ${secret.length}). Generate one: openssl rand -base64 48`,
    );
  }

  return secret;
};

export const DATABASE_URL = required("DATABASE_URL");
export const JWT_SECRET = readJwtSecret();

/** Optional — app.ts falls back to a fixed allow-list when this is unset. */
export const FRONTEND_URL = process.env.FRONTEND_URL?.trim() || undefined;

export const NODE_ENV = process.env.NODE_ENV?.trim() || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
