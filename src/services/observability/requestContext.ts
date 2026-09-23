/**
 * Per-request context (CC-05).
 *
 * Holds the request id and the authenticated user id for the lifetime of one
 * request, so that a log line written five calls deep in a service can be
 * correlated with the request that caused it — without threading a context
 * parameter through every function signature in the codebase.
 *
 * `AsyncLocalStorage` rather than a module-level variable: Node serves
 * overlapping requests on one thread, and a module-level "current request"
 * would attribute one student's error to whoever happened to be mid-await.
 * That is not a theoretical race — it is the normal case under any concurrency
 * at all, and it would put the wrong user id on a security-relevant log line.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  /** Correlates every log line and error report from one request. */
  requestId: string;
  /** Set by the auth middleware once a token is verified. Absent for public routes. */
  userId?: string;
  role?: string;
  method: string;
  path: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with `context` visible to everything it awaits. */
export const runWithContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

/** The current context, or undefined outside a request (cron, scripts, tests). */
export const getContext = (): RequestContext | undefined => storage.getStore();

/**
 * Attach the authenticated principal once auth has run.
 *
 * Mutates in place rather than re-running the storage, because the context
 * object is already the one every downstream call will read.
 */
export const setContextUser = (userId: string, role?: string): void => {
  const context = storage.getStore();
  if (!context) return;
  context.userId = userId;
  // Assigned only when present. Under `exactOptionalPropertyTypes` an explicit
  // `undefined` is not the same as an absent key, and writing one would put
  // `"role": undefined` into every log line for an unauthenticated caller.
  if (role !== undefined) context.role = role;
};
