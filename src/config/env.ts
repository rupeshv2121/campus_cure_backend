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

/* ------------------------------------------------------------------ *
 * AI configuration (CC-10)
 *
 * Deliberately NOT required: the application must start and serve every
 * core action with no AI credentials at all. Embedding is an enhancement,
 * never a dependency — see docs/adr/0001-ai-provider-strategy.md.
 * ------------------------------------------------------------------ */

export const HF_API_TOKEN = process.env.HF_API_TOKEN?.trim() || undefined;

/**
 * The canonical embedding model. Changing this invalidates every stored
 * vector and requires a full backfill: vectors from different models are not
 * comparable. The repository refuses to write a vector tagged with a
 * different model, so a change fails loudly instead of silently corrupting
 * the index.
 */
export const HF_EMBEDDING_MODEL =
  process.env.HF_EMBEDDING_MODEL?.trim() ||
  "sentence-transformers/all-MiniLM-L6-v2";

export const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ?? 384,
);

/** Measured at ~7ms/item at this size; per-item calls are ~572ms. */
export const EMBEDDING_BATCH_SIZE = Number(
  process.env.EMBEDDING_BATCH_SIZE ?? 50,
);

/**
 * Master switch. Defaults to on when a token is present and off otherwise, so
 * tests and token-less checkouts work with no configuration, while an explicit
 * `AI_ENABLED=false` always wins.
 */
export const AI_ENABLED =
  process.env.AI_ENABLED?.trim().toLowerCase() === "false"
    ? false
    : Boolean(HF_API_TOKEN);

/** Shared secret for internal endpoints (the embedding drain). */
export const INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET?.trim() || undefined;

/**
 * Cosine-similarity floor for calling two complaints duplicates (CC-13).
 *
 * Calibrated 2026-09-20 on 16 labelled pairs: the lowest true duplicate scored
 * 0.538 and the highest distinct pair 0.499 ("Fan not working" vs "Fan making
 * loud noise" — same object, different fault). 0.52 is the midpoint, which
 * separates that set perfectly.
 *
 * The margin is narrow (0.039) and n is small, which is why this is an env var.
 * Re-run `npx tsx src/scripts/calibrateDuplicateThreshold.ts` before changing it.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = Number(
  process.env.DUPLICATE_SIMILARITY_THRESHOLD ?? 0.52,
);

/* --- Generation (CC-12, CC-15). Unlike embeddings, these CAN fail over. --- */

export const GROQ_API_KEY = process.env.GROQ_API_KEY?.trim() || undefined;
export const GROQ_MODEL =
  process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY?.trim() || undefined;
export const MISTRAL_MODEL =
  process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest";

/**
 * Hours a doubt must go unanswered before an AI draft is generated.
 *
 * Humans get first refusal. Without this, CC-12 would undercut the community
 * CC-25 is meant to build: if the AI always answers first, nobody else will.
 */
export const DRAFT_DELAY_HOURS = Number(
  process.env.DRAFT_DELAY_HOURS ?? 24,
);

/** Set by Vercel Cron, which sends it as `Authorization: Bearer <secret>`. */
export const CRON_SECRET = process.env.CRON_SECRET?.trim() || undefined;

if (!Number.isInteger(EMBEDDING_DIMENSIONS) || EMBEDDING_DIMENSIONS <= 0) {
  fatal(`EMBEDDING_DIMENSIONS must be a positive integer.`);
}
