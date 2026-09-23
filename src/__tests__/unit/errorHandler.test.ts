/**
 * CC-05: the central error handler, against a real Express app.
 *
 * Before CC-05 the API had no error handler at all. An unhandled throw fell
 * through to Express's default, which answers with an **HTML** page — and,
 * outside production, one containing the stack trace. Two failures in one: a
 * JSON client cannot parse the body, and a stack reaches the browser.
 *
 * These tests pin both halves of the fix, plus the log-injection guard on the
 * client-supplied request id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  LOG_LEVEL: "silent",
  LOG_JSON: true,
  IS_PRODUCTION: false,
  NODE_ENV: "test",
  SENTRY_DSN: undefined as string | undefined,
  SENTRY_ENABLED: false,
  SENTRY_ENVIRONMENT: "test",
  SENTRY_TIMEOUT_MS: 50,
}));

vi.mock("../../config/env.js", () => env);

import express from "express";
import request from "supertest";
import {
  __testing,
  errorHandler,
  notFoundHandler,
  requestLogger,
} from "../../middleware/observability.js";

const { safeRequestId } = __testing;

/** A minimal app wired exactly as app.ts wires the real one. */
const makeApp = () => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());

  app.get("/ok", (_req, res) => {
    res.json({ fine: true });
  });

  app.get("/throw", () => {
    throw new Error("synchronous boom");
  });

  // Express 5 forwards a rejected async handler to the error middleware.
  // Express 4 did not, which is why this case is pinned.
  app.get("/reject", async () => {
    await Promise.resolve();
    throw new Error("async boom");
  });

  app.get("/cors-ish", () => {
    throw new Error("CORS: origin 'https://evil.example' not allowed");
  });

  app.get("/late", (_req, res) => {
    res.status(200).write("partial");
    throw new Error("after headers");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

beforeEach(() => {
  env.IS_PRODUCTION = false;
});

describe("requestLogger", () => {
  it("returns a request id on a successful response", async () => {
    const res = await request(makeApp()).get("/ok");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("echoes a caller-supplied request id, so traces join up", async () => {
    const res = await request(makeApp())
      .get("/ok")
      .set("x-request-id", "trace-abc-123");
    expect(res.headers["x-request-id"]).toBe("trace-abc-123");
  });


  it("bounds an absurdly long id", async () => {
    const res = await request(makeApp())
      .get("/ok")
      .set("x-request-id", "a".repeat(5000));
    expect((res.headers["x-request-id"] as string).length).toBe(64);
  });

  it("falls back to a generated id when the header is only junk", async () => {
    const res = await request(makeApp()).get("/ok").set("x-request-id", "!!!!");
    expect(res.headers["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  });
});

/**
 * Tested directly rather than over HTTP.
 *
 * Node's own http layer rejects a header containing CRLF before Express ever
 * sees it, so supertest physically cannot deliver the attack this guards
 * against — an attempt fails in the client with "Invalid character in header
 * content". That makes this sanitiser defence in depth rather than the only
 * barrier, which is the right posture: it still runs if the value arrives from
 * a proxy, a queue, or some future caller that is not an HTTP header at all.
 */
describe("safeRequestId", () => {
  it("strips CRLF, so a caller cannot forge log entries", () => {
    const id = safeRequestId("abc\r\nlevel=error message=forged");
    expect(id).not.toMatch(/[\r\n]/);
    expect(id).toBe("abclevelerrormessageforged");
  });

  it("keeps the characters a real trace id uses", () => {
    expect(safeRequestId("trace-abc_123.4")).toBe("trace-abc_123.4");
  });

  it("bounds the length", () => {
    expect(safeRequestId("a".repeat(5000)).length).toBe(64);
  });

  it.each([undefined, null, 42, {}, [], ""])(
    "generates a uuid for %s",
    (input) => {
      expect(safeRequestId(input)).toMatch(/^[a-f0-9-]{36}$/);
    },
  );
});

describe("errorHandler", () => {
  it.each([
    ["/throw", "synchronous boom"],
    ["/reject", "async boom"],
  ])("turns a throw from %s into JSON, not HTML", async (path, detail) => {
    const res = await request(makeApp()).get(path);

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error).toBe("Something went wrong. Please try again.");
    // Present outside production, and the thing that makes the handler usable
    // for a developer rather than something they work around.
    expect(res.body.detail).toBe(detail);
  });

  it("returns the request id so a student can quote it", async () => {
    const res = await request(makeApp())
      .get("/throw")
      .set("x-request-id", "trace-1");
    expect(res.body.requestId).toBe("trace-1");
  });

  /**
   * The guarantee that matters most. A stack trace names internal paths,
   * dependency versions and sometimes values — none of which belongs in a
   * response to a browser.
   */
  it("leaks nothing in production", async () => {
    env.IS_PRODUCTION = true;
    const res = await request(makeApp()).get("/throw");

    expect(res.status).toBe(500);
    expect(res.body.detail).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/synchronous boom/);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts:/);
    // The id still comes back: it is how support correlates the report.
    expect(res.body.requestId).toBeDefined();
  });

  it("answers 403 for a CORS rejection rather than 500", async () => {
    const res = await request(makeApp()).get("/cors-ish");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Origin not allowed");
  });

  it("does not corrupt a response that already started", async () => {
    // Writing a second body over a partial one produces a response no client
    // can parse; ending it is the only correct move.
    const res = await request(makeApp()).get("/late");
    expect(res.text).toBe("partial");
  });
});

describe("notFoundHandler", () => {
  it("answers unmatched routes with JSON", async () => {
    const res = await request(makeApp()).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error).toBe("Cannot GET /no-such-route");
  });

  it("does not shadow routes that do exist", async () => {
    expect((await request(makeApp()).get("/ok")).status).toBe(200);
  });
});
