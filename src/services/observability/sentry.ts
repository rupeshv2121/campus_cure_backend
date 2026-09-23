/**
 * Minimal Sentry reporter (CC-05).
 *
 * Posts a single envelope to Sentry's ingest API over plain `fetch`, with no
 * SDK.
 *
 * ## Why no @sentry/node
 *
 * Consistent with every other provider in this codebase — HuggingFace, Groq,
 * Mistral, Resend and Telegram are all hand-rolled against their HTTP APIs.
 * Beyond consistency, the SDK's v8+ line pulls in OpenTelemetry
 * auto-instrumentation and monkey-patches the runtime at import time, which is
 * a large bundle and a lot of behaviour to add to a serverless function whose
 * cold start is already the thing users feel.
 *
 * What that costs us, stated plainly rather than discovered later:
 *
 *  - **No breadcrumbs.** An error arrives without the trail of what preceded
 *    it. Partly compensated by the request id: the structured logs for that
 *    request ARE the trail, one grep away.
 *  - **No automatic source maps.** Stack frames point at compiled output.
 *  - **No performance tracing or profiling.**
 *  - **No automatic capture of unhandled rejections** beyond what is wired up
 *    explicitly in `index.ts`.
 *
 * If any of those become the binding constraint, this module is the seam:
 * `captureException` is the entire surface, and swapping the body for
 * `Sentry.captureException` is a contained change.
 *
 * ## Why the send is awaited
 *
 * A Vercel lambda freezes the instant the response is flushed. A
 * fire-and-forget POST is therefore a POST that frequently never leaves the
 * machine — the same reason CC-03 puts email in a durable outbox rather than
 * sending inline. Errors are rare enough that a bounded wait on the error path
 * is acceptable, where it would not be on every request.
 */
import { randomUUID } from "node:crypto";
import {
  SENTRY_DSN,
  SENTRY_ENABLED,
  SENTRY_ENVIRONMENT,
  SENTRY_TIMEOUT_MS,
} from "../../config/env.js";
import { getContext } from "./requestContext.js";
import { redact } from "./logger.js";

interface ParsedDsn {
  envelopeUrl: string;
  publicKey: string;
}

/**
 * A DSN is `https://<publicKey>@<host>/<projectId>`.
 *
 * Parsed once at module load. A malformed DSN is already rejected by
 * `env.ts`, so this returning null means the DSN was absent, not invalid.
 */
const parseDsn = (dsn: string | undefined): ParsedDsn | null => {
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return null;

    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
};

const dsn = parseDsn(SENTRY_DSN);

export const isSentryEnabled = (): boolean => SENTRY_ENABLED && dsn !== null;

export interface CaptureOptions {
  level?: "error" | "warning" | "info";
  /** Searchable key/value pairs. Indexed by Sentry; keep cardinality low. */
  tags?: Record<string, string>;
  /** Arbitrary detail. Redacted before it leaves the process. */
  extra?: Record<string, unknown>;
}

/**
 * Build the exception payload.
 *
 * The stack is sent as a single pre-formatted string rather than parsed into
 * frames. Sentry renders it, but cannot link frames to source without the
 * parsing the SDK would do — the trade recorded in the file header.
 */
const buildEvent = (error: unknown, options: CaptureOptions) => {
  const context = getContext();
  const err =
    error instanceof Error ? error : new Error(String(error));

  return {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: options.level ?? "error",
    environment: SENTRY_ENVIRONMENT,
    logger: "campuscure",
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: { frames: [] },
        },
      ],
    },
    // The stack lives here because we do not parse it into frames.
    extra: redact({
      stack: err.stack,
      ...(options.extra ?? {}),
    }) as Record<string, unknown>,
    tags: {
      ...(options.tags ?? {}),
      ...(context ? { request_id: context.requestId } : {}),
    },
    ...(context?.userId
      ? // id only. Sending email or name here would copy personal data into a
        // third-party system that CC-64's erasure path cannot reach.
        { user: { id: context.userId } }
      : {}),
    ...(context
      ? {
          request: {
            method: context.method,
            // Path, never the full URL: query strings in this API carry
            // search terms and ids, and a URL is the easiest place to leak a
            // token someone put in a query param by mistake.
            url: context.path,
          },
        }
      : {}),
  };
};

/**
 * Report an error. Never throws, never rejects.
 *
 * A failure to report is logged at debug and swallowed: an observability
 * system that can take the application down with it is worse than no
 * observability system.
 */
export const captureException = async (
  error: unknown,
  options: CaptureOptions = {},
): Promise<void> => {
  if (!isSentryEnabled() || !dsn) return;

  const event = buildEvent(error, options);

  // Envelope format: a newline-delimited header / item-header / item triple.
  const body = [
    JSON.stringify({ event_id: event.event_id, sent_at: event.timestamp }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SENTRY_TIMEOUT_MS);

  try {
    await fetch(dsn.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": [
          "Sentry sentry_version=7",
          "sentry_client=campuscure/1.0",
          `sentry_key=${dsn.publicKey}`,
        ].join(", "),
      },
      body,
      signal: controller.signal,
    });
  } catch {
    // Deliberately silent. Using `logger.error` here could recurse if the
    // logger itself is what failed, and a noisy reporter failure would bury
    // the original error it was trying to report.
  } finally {
    clearTimeout(timer);
  }
};

/** Exposed for the test suite. */
export const __testing = { parseDsn, buildEvent };
