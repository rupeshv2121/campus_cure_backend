/**
 * CC-05: logging, error reporting and the central error handler.
 *
 * The load-bearing guarantees here are about what must NOT happen. Log output
 * reaches Vercel and Sentry reaches a third party, and this codebase handles
 * passwords, refresh tokens, a Supabase service-role key, biometric templates
 * and students' guardian phone numbers. A redaction gap is not a cosmetic bug:
 * it copies a live credential into a system that CC-64's erasure path cannot
 * reach, permanently.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  LOG_LEVEL: "debug",
  LOG_JSON: true,
  IS_PRODUCTION: false,
  NODE_ENV: "test",
  SENTRY_DSN: "https://abc123@o1.ingest.sentry.io/42",
  SENTRY_ENABLED: true,
  SENTRY_ENVIRONMENT: "test",
  SENTRY_TIMEOUT_MS: 2000,
}));

vi.mock("../../config/env.js", () => env);

import { logger, redact } from "../../services/observability/logger.js";
import {
  runWithContext,
  setContextUser,
  getContext,
} from "../../services/observability/requestContext.js";
import { __testing as sentryTesting } from "../../services/observability/sentry.js";

const context = () => ({
  requestId: "req-1",
  method: "POST",
  path: "/api/students/doubts",
  startedAt: Date.now(),
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("redact", () => {
  it.each([
    "password",
    "Password",
    "JWT_SECRET",
    "refreshToken",
    "accessToken",
    "authorization",
    "apiKey",
    "SUPABASE_SERVICE_ROLE_KEY",
    "faceDescriptor",
    "guardianPhone",
    "email",
  ])("redacts %s", (key) => {
    expect(redact({ [key]: "sensitive-value" })).toEqual({
      [key]: "[redacted]",
    });
  });

  it("keeps values that are safe to log", () => {
    expect(redact({ userId: "u1", status: 200, count: 3 })).toEqual({
      userId: "u1",
      status: 200,
      count: 3,
    });
  });

  it("redacts nested secrets, not just top-level ones", () => {
    expect(
      redact({ user: { id: "u1", password: "hunter2" } }),
    ).toEqual({ user: { id: "u1", password: "[redacted]" } });
  });

  /**
   * A Prisma model can carry a cyclic relation. An unbounded walk would hang
   * the request rather than log it, which turns a logging call into an outage.
   */
  it("stops at the depth limit instead of recursing forever", () => {
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.self = cyclic;
    expect(() => JSON.stringify(redact(cyclic))).not.toThrow();
  });

  it("truncates a huge string rather than logging all of it", () => {
    const result = redact({ body: "x".repeat(10_000) }) as { body: string };
    expect(result.body.length).toBeLessThan(2_100);
    expect(result.body).toMatch(/10000 chars/);
  });

  it("unpacks an Error into name, message and stack", () => {
    const result = redact(new Error("boom")) as Record<string, unknown>;
    expect(result.name).toBe("Error");
    expect(result.message).toBe("boom");
    expect(result.stack).toContain("boom");
  });

  it("bounds a long array", () => {
    expect((redact(Array.from({ length: 500 }, (_, i) => i)) as unknown[]).length)
      .toBe(50);
  });
});

describe("logger", () => {
  it("emits JSON carrying the request id", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    runWithContext(context(), () => logger.info("hello", { status: 200 }));

    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "info",
      message: "hello",
      requestId: "req-1",
      status: 200,
    });
  });

  it("includes the user id once auth has run", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    runWithContext(context(), () => {
      setContextUser("student-7", "STUDENT");
      logger.info("after auth");
    });

    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.userId).toBe("student-7");
    expect(line.role).toBe("STUDENT");
  });

  it("redacts fields passed to it", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.info("login", { password: "hunter2" });
    expect(spy.mock.calls[0]![0]).toContain("[redacted]");
    expect(spy.mock.calls[0]![0]).not.toContain("hunter2");
  });

  it("sends warn and error to stderr so platform filters separate them", () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.info("fine");
    logger.warn("hmm");
    logger.error("bad");

    expect(out).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledTimes(2);
  });

  it("works outside a request, where there is no context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(() => logger.info("from a cron job")).not.toThrow();
    expect(JSON.parse(spy.mock.calls[0]![0] as string).requestId).toBeUndefined();
  });

  it("isolates context between concurrent requests", async () => {
    const seen: Array<string | undefined> = [];

    await Promise.all([
      new Promise<void>((resolve) =>
        runWithContext({ ...context(), requestId: "a" }, async () => {
          await new Promise((r) => setTimeout(r, 10));
          seen.push(getContext()?.requestId);
          resolve();
        }),
      ),
      new Promise<void>((resolve) =>
        runWithContext({ ...context(), requestId: "b" }, async () => {
          seen.push(getContext()?.requestId);
          resolve();
        }),
      ),
    ]);

    // The whole reason for AsyncLocalStorage: a module-level "current request"
    // would report "b" for both once the first one awaited.
    expect(seen.sort()).toEqual(["a", "b"]);
  });
});

describe("sentry", () => {
  const { parseDsn, buildEvent } = sentryTesting;

  it("parses a DSN into an envelope URL and public key", () => {
    expect(parseDsn("https://abc123@o1.ingest.sentry.io/42")).toEqual({
      envelopeUrl: "https://o1.ingest.sentry.io/api/42/envelope/",
      publicKey: "abc123",
    });
  });

  it.each([undefined, "", "not-a-url", "https://o1.ingest.sentry.io/42"])(
    "returns null for %s",
    (dsn) => {
      expect(parseDsn(dsn as string | undefined)).toBeNull();
    },
  );

  it("tags the event with the request id", () => {
    const event = runWithContext(context(), () =>
      buildEvent(new Error("boom"), {}),
    );
    expect(event.tags.request_id).toBe("req-1");
    expect(event.exception.values[0]!.value).toBe("boom");
  });

  /**
   * Sentry is a third party and CC-64 gives students a right to erasure that
   * cannot reach it. An opaque id is enough to debug with; a name or an email
   * is personal data we would be unable to delete on request.
   */
  it("sends the user id but never their name or email", () => {
    const event = runWithContext(context(), () => {
      setContextUser("student-7", "STUDENT");
      return buildEvent(new Error("boom"), {
        extra: { email: "a@b.com", name: "Real Person" },
      });
    });

    expect(event.user).toEqual({ id: "student-7" });
    expect(JSON.stringify(event)).not.toContain("a@b.com");
    expect(event.extra.email).toBe("[redacted]");
  });

  it("sends the path, never the query string", () => {
    const event = runWithContext(context(), () => buildEvent(new Error("x"), {}));
    expect(event.request?.url).toBe("/api/students/doubts");
  });

  it("coerces a non-Error throw into an Error", () => {
    const event = buildEvent("just a string", {});
    expect(event.exception.values[0]!.value).toBe("just a string");
  });
});
