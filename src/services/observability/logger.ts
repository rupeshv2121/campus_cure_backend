/**
 * Structured logging (CC-05).
 *
 * One line per event, JSON in production and human-readable locally. Every
 * line carries the request id from `requestContext`, so a 500 in Vercel's log
 * stream can be traced back through whatever the request did before it failed.
 *
 * ## Why not a logging library
 *
 * Consistent with every other integration in this codebase, which speaks to
 * providers over plain `fetch` rather than an SDK. pino or winston would add a
 * dependency and a transport layer to do what `console.log` plus `JSON
 * .stringify` already does correctly on a platform that captures stdout. If
 * log volume ever justifies sampling or async transports, this module is the
 * single place that changes.
 *
 * ## Redaction is not optional
 *
 * Log output reaches Vercel, and from there whoever can read the dashboard.
 * This codebase handles passwords, JWTs, refresh tokens, a Supabase
 * service-role key, biometric templates and students' guardian phone numbers.
 * `redact` is applied to every metadata object, and the key list is
 * deliberately broad — a false positive costs a `[redacted]` in a log line,
 * while a false negative puts a live credential in a log aggregator forever.
 */
import { LOG_JSON, LOG_LEVEL } from "../../config/env.js";
import { getContext } from "./requestContext.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const threshold = LEVEL_ORDER[LOG_LEVEL as LogLevel | "silent"] ?? 20;

/**
 * Substrings that mark a key as sensitive, matched case-insensitively.
 *
 * Substring rather than exact match so that `refreshToken`, `token`,
 * `accessToken` and `telegramLinkHash` are all caught by two entries.
 */
const SENSITIVE_KEY_PARTS = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "descriptor", // CC-60 biometric templates
  "faceencryption",
  "servicerole",
  "dsn",
  "guardianphone",
  "phonenumber",
  "email", // addresses are personal data under DPDP; ids are enough to debug
];

/**
 * Separators are stripped from BOTH sides before matching.
 *
 * Keeping underscores was a real bug, caught by the test for
 * `SUPABASE_SERVICE_ROLE_KEY`: the key normalised to
 * `supabase_service_role_key`, the pattern `servicerole` had no underscore,
 * and the two never matched — so the one credential in this project that
 * grants full database access was the one being logged in clear text.
 *
 * Reducing both to bare letters makes `SERVICE_ROLE`, `serviceRole` and
 * `service-role` all match one pattern.
 */
const lettersOnly = (value: string): string =>
  value.toLowerCase().replace(/[^a-z]/g, "");

const isSensitive = (key: string): boolean => {
  const normalized = lettersOnly(key);
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(lettersOnly(part)));
};

const MAX_DEPTH = 4;
const MAX_STRING = 2000;

/**
 * Replace sensitive values and bound the size of what is logged.
 *
 * Depth-limited because an accidentally logged Prisma model can carry a cyclic
 * relation, and an unbounded walk would hang the request rather than log it.
 */
export const redact = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return "[depth-limit]";

  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]`
      : value;
  }

  if (typeof value !== "object") return value;

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => redact(entry, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitive(key) ? "[redacted]" : redact(entry, depth + 1);
  }
  return output;
};

export interface LogFields {
  [key: string]: unknown;
}

const emit = (level: LogLevel, message: string, fields?: LogFields): void => {
  if (LEVEL_ORDER[level] < threshold) return;

  const context = getContext();
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context
      ? {
          requestId: context.requestId,
          ...(context.userId ? { userId: context.userId } : {}),
          ...(context.role ? { role: context.role } : {}),
        }
      : {}),
    ...(fields ? (redact(fields) as LogFields) : {}),
  };

  // stderr for warn/error so platform log filters separate them; stdout
  // otherwise. Vercel captures both.
  const sink = level === "error" || level === "warn" ? console.error : console.log;

  if (LOG_JSON) {
    sink(JSON.stringify(payload));
    return;
  }

  const { level: _l, time: _t, message: _m, ...rest } = payload;
  const suffix = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  sink(`[${level}] ${message}${suffix}`);
};

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/** Exposed for the test suite. */
export const __testing = { isSensitive, LEVEL_ORDER };
