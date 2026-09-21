/**
 * Environment configuration with fail-fast validation.
 *
 * This module validates at import time, before the server accepts a request.
 * A missing or weak secret must stop the process rather than silently degrade
 * authentication — see docs/specs/CC-01-security-baseline.md.
 */

import { createHash } from "node:crypto";

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Secrets that have been present in source control at some point. Even if one
 * is later set explicitly via the environment, it must never be accepted: it is
 * public, so any token signed with it is forgeable by anyone who can read the
 * repository.
 */
const BANNED_SECRETS = new Set(["your-secret-key-change-in-production"]);

/**
 * SHA-256 of secrets known to have leaked outside the project.
 *
 * Hashes rather than literals, so blocking a compromised value does not
 * republish it here.
 *
 * A leaked secret is not a weak one — the entry below is 64 characters and
 * passes every length and entropy check. That is exactly why this list is
 * needed: the length rule cannot catch it, and a warning in a chat log is not
 * a control. Anything on this list makes the process refuse to start, in every
 * environment, permanently.
 *
 * To add one:  node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<secret>"
 */
const BANNED_SECRET_HASHES = new Set([
  // Leaked into a shared transcript on 2026-09-20 via an editor selection.
  "b79c03419d2a569542b7d1eb91963fef92817b721c3907ddb0205cf36ef679bb",
]);

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

  if (BANNED_SECRET_HASHES.has(createHash("sha256").update(secret).digest("hex"))) {
    fatal(
      "JWT_SECRET matches a value known to have leaked outside this project. " +
        "It is long enough, but it is not secret, so tokens signed with it are " +
        "forgeable by anyone who has seen it. Generate a new one and do not " +
        "paste it anywhere: openssl rand -base64 48",
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

/**
 * Complaint intake strategy (CC-14).
 *
 * false (default): rules run first and the model is called only on a miss.
 * true: the model is always consulted.
 *
 * Measured on 20 labelled complaints: rules-first scores 85% against
 * model-always at 95%. The whole 10-point gap is "trap" cases — text
 * containing a category keyword that is incidental, such as a wasp nest
 * outside a WINDOW — because a rules hit never reaches the model.
 *
 * Rules-first is still the default: it answered 55% of cases at zero cost and
 * zero latency, which matters on a free tier, and the student confirms every
 * suggestion so a wrong one is corrected rather than filed. Set this to true if
 * quota stops being the binding constraint.
 *
 * Re-measure before changing it: npx tsx src/scripts/evalIntake.ts
 */
export const INTAKE_PREFER_MODEL =
  process.env.INTAKE_PREFER_MODEL?.trim().toLowerCase() === "true";

/**
 * Access token lifetime (CC-01b).
 *
 * Short by design: an access token cannot be revoked, so its blast radius is
 * bounded only by how long it lives. The refresh token behind it carries the
 * session, and that one IS revocable.
 *
 * An env var rather than a constant because if this proves too aggressive on
 * flaky campus wifi it must be adjustable without a deploy.
 */
const parseDurationToSeconds = (value: string, fallback: number): number => {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[unit] ?? 1;
  return amount * multiplier;
};

/**
 * Expressed in seconds rather than a duration string so it is unambiguous and
 * typechecks against jsonwebtoken's `expiresIn`. The env var still accepts the
 * friendly form: "15m", "2h", "900".
 */
export const ACCESS_TOKEN_TTL_SECONDS = parseDurationToSeconds(
  process.env.ACCESS_TOKEN_TTL ?? "15m",
  900,
);

export const REFRESH_TOKEN_TTL_DAYS = Number(
  process.env.REFRESH_TOKEN_TTL_DAYS ?? 7,
);

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

/**
 * Minimum cosine similarity for a doubt to be usable as grounding (CC-12).
 *
 * Search can afford loosely related results — the reader judges. Grounding
 * cannot: feeding an answer about SQL JOINs to a question about clustered
 * indexes produces a draft that says "the reference material does not cover
 * this", which wastes the reviewer's time and makes the feature look broken.
 * Observed in seeded data before this floor existed.
 */
export const GROUNDING_SIMILARITY_THRESHOLD = Number(
  process.env.GROUNDING_SIMILARITY_THRESHOLD ?? 0.45,
);

/** Set by Vercel Cron, which sends it as `Authorization: Bearer <secret>`. */
export const CRON_SECRET = process.env.CRON_SECRET?.trim() || undefined;

/* ------------------------------------------------------------------ *
 * Email (CC-03)
 *
 * Optional, like storage and the AI block. Absent key => EMAIL_ENABLED is
 * false, enqueueing is a logged no-op, and the drain returns zeroes without
 * touching the table. An email layer that half-works is worse than one that is
 * off: a queued message nobody drains looks delivered to the code that queued
 * it.
 * ------------------------------------------------------------------ */

/** Read only inside src/services/email/resend.ts. Never returned in a response. */
export const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || undefined;

export const EMAIL_ENABLED = Boolean(RESEND_API_KEY);

/**
 * Sender address.
 *
 * `onboarding@resend.dev` is the only sender Resend allows before a domain is
 * verified through DNS. Changing this without verifying the domain first makes
 * every send fail, not fall back.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || "CampusCure <onboarding@resend.dev>";

/**
 * Divert every email to one address.
 *
 * THIS IS A SAFETY CATCH, NOT A CONVENIENCE. There are real students in this
 * database with real addresses. Until a domain is verified, Resend will only
 * deliver to the account owner anyway - but the moment it IS verified, an
 * untested drain would mail all of them. Leave this set until the emails
 * themselves (CC-40) have been reviewed.
 *
 * The outbox row always records the true recipient, so switching this off is a
 * config change rather than a re-send.
 */
export const EMAIL_REDIRECT_TO =
  process.env.EMAIL_REDIRECT_TO?.trim() || undefined;

/** Attempts before a message is parked as FAILED. */
export const EMAIL_MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS ?? 5);

/** Messages sent per drain. Bounded so one drain cannot exhaust a daily quota. */
export const EMAIL_DRAIN_BATCH_SIZE = Number(
  process.env.EMAIL_DRAIN_BATCH_SIZE ?? 20,
);

if (!Number.isInteger(EMAIL_MAX_ATTEMPTS) || EMAIL_MAX_ATTEMPTS <= 0) {
  fatal("EMAIL_MAX_ATTEMPTS must be a positive integer.");
}

/* ------------------------------------------------------------------ *
 * Face login (CC-60)
 *
 * Face is the SECOND factor, never the first. The descriptor is computed in
 * the browser, so anyone can POST 128 floats without a camera - which makes
 * face-as-a-first-factor a bearer secret derived from a photograph. The
 * password is what actually guards the account; this step raises the cost of
 * the casual attack on top of it.
 * ------------------------------------------------------------------ */

/**
 * 32 bytes, base64. Generate: openssl rand -base64 32
 *
 * Absent means face login is OFF - enrolment refuses and the password step
 * never asks for a face. A half-configured biometric path is worse than none,
 * the same reasoning as CC-02 and CC-03.
 */
export const FACE_ENCRYPTION_KEY =
  process.env.FACE_ENCRYPTION_KEY?.trim() || undefined;

export const FACE_LOGIN_ENABLED = Boolean(FACE_ENCRYPTION_KEY);

/**
 * Max euclidean distance for a 1:1 match.
 *
 * Tighter than face-api.js's usual 0.6, which is tuned for 1:N identification
 * where a miss is an inconvenience. This guards a session, and a false accept
 * is worse than a retry.
 */
export const FACE_MATCH_THRESHOLD = Number(
  process.env.FACE_MATCH_THRESHOLD ?? 0.5,
);

/**
 * Minimum pairwise distance between submitted samples.
 *
 * A photograph held to a camera produces near-identical descriptors frame
 * after frame. NOT calibrated against real captures yet - see the spec's open
 * questions. Raise it only with measurements.
 */
export const FACE_LIVENESS_MIN_VARIANCE = Number(
  process.env.FACE_LIVENESS_MIN_VARIANCE ?? 0.02,
);

export const FACE_CHALLENGE_TTL_SECONDS = Number(
  process.env.FACE_CHALLENGE_TTL_SECONDS ?? 120,
);

/** Verifies allowed per challenge before it is dead. */
export const FACE_MAX_ATTEMPTS = Number(process.env.FACE_MAX_ATTEMPTS ?? 3);

/** Samples the client must submit, from separate moments. */
export const FACE_REQUIRED_SAMPLES = Number(
  process.env.FACE_REQUIRED_SAMPLES ?? 3,
);

if (FACE_MATCH_THRESHOLD <= 0 || FACE_MATCH_THRESHOLD >= 1) {
  fatal("FACE_MATCH_THRESHOLD must be between 0 and 1.");
}

if (!Number.isInteger(FACE_MAX_ATTEMPTS) || FACE_MAX_ATTEMPTS <= 0) {
  fatal("FACE_MAX_ATTEMPTS must be a positive integer.");
}

/**
 * Public base URL of THIS backend.
 *
 * Needed because the unsubscribe link is clicked from an inbox and must reach
 * the API, which is a different origin from the frontend. Using FRONTEND_URL
 * for it produces a link to a route the frontend does not have.
 */
export const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL?.trim() ||
  "https://campus-cure-backend.vercel.app";

/**
 * CC-40 master switch for notification email.
 *
 * Separate from EMAIL_ENABLED on purpose: this turns off *notification* mail
 * while leaving the CC-03 pipe available for anything else (an OTP, a test).
 * Off means no notification ever emails, whatever the type policy or the
 * user's own preference says.
 */
export const NOTIFICATION_EMAILS_ENABLED =
  process.env.NOTIFICATION_EMAILS_ENABLED?.trim().toLowerCase() !== "false";

/* ------------------------------------------------------------------ *
 * File storage (CC-02)
 *
 * Optional, like the AI block above.
 *
 * An earlier revision made these required, on the reasoning that a
 * half-configured upload path loses a student's file. That reasoning is right
 * about the *upload* and wrong about the *process*: refusing to boot means a
 * developer with no storage credentials cannot run doubts, complaints or
 * anything else either. The failure is contained where it belongs instead —
 * STORAGE_ENABLED is false, the two upload routes answer 503, and every read
 * path behaves as though no file was ever attached.
 *
 * Both values must be present for storage to switch on. One without the other
 * is a misconfiguration, not a half-working feature.
 * ------------------------------------------------------------------ */

export const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || undefined;

/**
 * The service role key bypasses row level security, so it is a full-access
 * credential for the storage bucket. It is read here, used only inside
 * src/services/storage/supabaseStorage.ts, and must never be returned in a
 * response or shipped to the browser — the whole point of signing uploads
 * server-side is that the client never needs it.
 */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;

/**
 * Master switch. Everything attachment-related checks this first.
 *
 * Note this says nothing about whether the bucket exists or the `Attachment`
 * table has been migrated — it only reports that credentials are present. The
 * storage module surfaces the rest as ordinary errors.
 */
export const STORAGE_ENABLED = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY,
);

export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "campuscure-attachments";

/**
 * Hard ceiling on one attachment, enforced twice: once against the size the
 * client claims at signing time, and again against the object's real size at
 * confirmation. The first is a courtesy that fails fast; the second is the
 * one that actually holds, because a client can lie.
 */
export const ATTACHMENT_MAX_BYTES = Number(
  process.env.ATTACHMENT_MAX_BYTES ?? 5 * 1024 * 1024,
);

export const ATTACHMENT_MAX_PER_ENTITY = Number(
  process.env.ATTACHMENT_MAX_PER_ENTITY ?? 5,
);

/** How long a signed upload URL stays valid. */
export const UPLOAD_URL_TTL_SECONDS = Number(
  process.env.UPLOAD_URL_TTL_SECONDS ?? 300,
);

/** How long a signed download URL stays valid. Short: these get screenshotted. */
export const DOWNLOAD_URL_TTL_SECONDS = Number(
  process.env.DOWNLOAD_URL_TTL_SECONDS ?? 300,
);

/** Hours a PENDING attachment may sit unconfirmed before the sweep removes it. */
export const ATTACHMENT_PENDING_TTL_HOURS = Number(
  process.env.ATTACHMENT_PENDING_TTL_HOURS ?? 24,
);

if (!Number.isInteger(ATTACHMENT_MAX_BYTES) || ATTACHMENT_MAX_BYTES <= 0) {
  fatal("ATTACHMENT_MAX_BYTES must be a positive integer.");
}

if (
  !Number.isInteger(ATTACHMENT_MAX_PER_ENTITY) ||
  ATTACHMENT_MAX_PER_ENTITY <= 0
) {
  fatal("ATTACHMENT_MAX_PER_ENTITY must be a positive integer.");
}

if (!Number.isInteger(EMBEDDING_DIMENSIONS) || EMBEDDING_DIMENSIONS <= 0) {
  fatal(`EMBEDDING_DIMENSIONS must be a positive integer.`);
}
