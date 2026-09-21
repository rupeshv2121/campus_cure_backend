/**
 * CC-40: the unsubscribe routes.
 *
 * The property worth a test of its own is that GET does not mutate. Mail
 * clients and security scanners prefetch links, and a GET that unsubscribed
 * would quietly opt people out who never clicked anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import request from "supertest";
import app from "../../app.js";
import { prismaMock, resetMockState } from "../helpers/prismaMock.js";

const stub = (model: string, method: string): ReturnType<typeof vi.fn> =>
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[
    model
  ]![method]!;

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
});

describe("GET /api/notifications/unsubscribe/:token", () => {
  it("shows a confirmation page without changing anything", async () => {
    stub("user", "findUnique").mockResolvedValueOnce({ id: "user-1" });

    const res = await request(app).get("/api/notifications/unsubscribe/tok-abc");

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/stop notification emails/i);
    // A scanner prefetching this link must not opt anyone out.
    expect(stub("user", "update")).not.toHaveBeenCalled();
  });

  it("offers a POST form, not a bare link", async () => {
    stub("user", "findUnique").mockResolvedValueOnce({ id: "user-1" });

    const res = await request(app).get("/api/notifications/unsubscribe/tok-abc");

    expect(res.text).toContain('method="POST"');
  });

  it("404s an unknown token", async () => {
    stub("user", "findUnique").mockResolvedValueOnce(null);

    const res = await request(app).get("/api/notifications/unsubscribe/nope");

    expect(res.status).toBe(404);
    expect(stub("user", "update")).not.toHaveBeenCalled();
  });

  it("needs no authentication — it is clicked from an inbox", async () => {
    stub("user", "findUnique").mockResolvedValueOnce({ id: "user-1" });

    const res = await request(app).get("/api/notifications/unsubscribe/tok-abc");

    expect(res.status).not.toBe(401);
  });
});

describe("POST /api/notifications/unsubscribe/:token", () => {
  it("turns notification email off", async () => {
    stub("user", "findUnique").mockResolvedValueOnce({ id: "user-1" });
    stub("user", "update").mockResolvedValueOnce({});

    const res = await request(app).post("/api/notifications/unsubscribe/tok-abc");

    expect(res.status).toBe(200);
    expect(stub("user", "update").mock.calls[0]![0].data).toEqual({
      emailNotifications: false,
    });
  });

  it("is idempotent — a second click still succeeds", async () => {
    stub("user", "findUnique").mockResolvedValue({ id: "user-1" });
    stub("user", "update").mockResolvedValue({});

    const first = await request(app).post("/api/notifications/unsubscribe/tok-abc");
    const second = await request(app).post("/api/notifications/unsubscribe/tok-abc");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("404s an unknown token", async () => {
    stub("user", "findUnique").mockResolvedValueOnce(null);

    const res = await request(app).post("/api/notifications/unsubscribe/nope");

    expect(res.status).toBe(404);
    expect(stub("user", "update")).not.toHaveBeenCalled();
  });

  it("says the in-app notifications continue", async () => {
    stub("user", "findUnique").mockResolvedValueOnce({ id: "user-1" });
    stub("user", "update").mockResolvedValueOnce({});

    const res = await request(app).post("/api/notifications/unsubscribe/tok-abc");

    expect(res.text).toMatch(/still appear in the app/i);
  });
});
