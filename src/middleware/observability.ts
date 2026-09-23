/**
 * Request logging and the central error handler (CC-05).
 *
 * Before this existed the API had no error handler at all: an unhandled throw
 * fell through to Express's default, which answers with an HTML error page —
 * and, when `NODE_ENV` is not production, that page contains the stack trace.
 * A JSON API returning HTML breaks every client's error parsing, and shipping
 * a stack to a browser is an information leak. Both are fixed here.
 */
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { IS_PRODUCTION } from "../config/env.js";
import { logger } from "../services/observability/logger.js";
import {
  runWithContext,
  type RequestContext,
} from "../services/observability/requestContext.js";
import { captureException } from "../services/observability/sentry.js";

/** Header clients and proxies may set to correlate their own traces with ours. */
const REQUEST_ID_HEADER = "x-request-id";

/**
 * A client-supplied id is echoed, but bounded and stripped first.
 *
 * It lands in log lines, so an unvalidated value is a log-injection vector:
 * a newline lets an attacker forge whole log entries, and an unbounded string
 * lets them flood the log.
 */
const safeRequestId = (raw: unknown): string => {
  if (typeof raw !== "string") return randomUUID();
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  return cleaned || randomUUID();
};

/**
 * Open a context for the request and log how it finished.
 *
 * Mounted first, so everything after it — including the rate limiters — runs
 * inside the context and can be correlated.
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const context: RequestContext = {
    requestId: safeRequestId(req.headers[REQUEST_ID_HEADER]),
    method: req.method,
    // `req.path` rather than `req.originalUrl`: the query string carries
    // search terms, ids, and occasionally a token someone pasted into the
    // wrong place. None of that belongs in a log line.
    path: req.path,
    startedAt: Date.now(),
  };

  res.setHeader(REQUEST_ID_HEADER, context.requestId);

  runWithContext(context, () => {
    // `finish` fires once the response is flushed, so status and duration are
    // both final. `close` would also fire on a client disconnect, which is a
    // different event and would double-log.
    res.once("finish", () => {
      const durationMs = Date.now() - context.startedAt;
      const level =
        res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

      logger[level]("request", {
        method: context.method,
        path: context.path,
        status: res.statusCode,
        durationMs,
      });
    });

    next();
  });
};

/**
 * The last middleware. Turns anything thrown into a JSON response.
 *
 * Express 5 forwards a rejected async handler here automatically, which
 * Express 4 did not — so this genuinely catches the `await` failures that
 * previously became unhandled rejections.
 */
export const errorHandler = async (
  error: unknown,
  req: Request,
  res: Response,
  // Required: Express identifies an error handler by arity, so removing this
  // unused parameter silently turns this back into ordinary middleware.
  _next: NextFunction,
): Promise<void> => {
  // A CORS rejection is a misconfigured or unexpected origin, not a bug.
  // Reporting it would fill Sentry with noise from crawlers and stale tabs.
  const isCors =
    error instanceof Error && error.message.startsWith("CORS: origin");

  const status = isCors ? 403 : 500;

  logger.error("unhandled error", {
    method: req.method,
    path: req.path,
    status,
    error,
  });

  if (!isCors) {
    // Awaited: the lambda freezes as soon as the response is sent. Bounded by
    // SENTRY_TIMEOUT_MS, and it never throws.
    await captureException(error, {
      tags: { method: req.method, path: req.path },
    });
  }

  if (res.headersSent) {
    // The response already started, so the only correct move is to end it.
    // Writing a second body here would corrupt the first.
    res.end();
    return;
  }

  res.status(status).json({
    error: isCors
      ? "Origin not allowed"
      : "Something went wrong. Please try again.",
    // The id is the whole point of returning anything else: a student can
    // quote it and it locates the exact log line and Sentry event.
    requestId: res.getHeader(REQUEST_ID_HEADER),
    // Never in production. Locally this is what makes the handler usable
    // rather than something developers work around.
    ...(IS_PRODUCTION
      ? {}
      : { detail: error instanceof Error ? error.message : String(error) }),
  });
};

/**
 * Exposed for the test suite.
 *
 * `safeRequestId` is tested directly rather than over HTTP because Node's own
 * http layer rejects a header containing CRLF before Express ever sees it - so
 * the CRLF case is unreachable through supertest. That makes this sanitiser
 * defence in depth rather than the only guard, which is the right posture: it
 * still runs if the value ever arrives from a proxy, a queue or a test.
 */
export const __testing = { safeRequestId };

/** 404 for anything that reached the end of the router without matching. */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
};
