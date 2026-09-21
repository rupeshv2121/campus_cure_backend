/**
 * CC-21 route behaviour, plus the route-ordering hazard both CC-20 and CC-21
 * carry.
 *
 * Two things are asserted here that no unit test of a service could catch:
 * that /doubts/bookmarked and /doubts/tags are not swallowed by /doubts/:id,
 * and that a bookmark query is always scoped to the caller.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import request from "supertest";
import app from "../../app.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import { prismaMock, resetMockState, setMockUser } from "../helpers/prismaMock.js";

const stub = (model: string, method: string): ReturnType<typeof vi.fn> =>
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[
    model
  ]![method]!;

const as = (role: Parameters<typeof userForRole>[0], id?: string) => {
  const user = id ? { ...userForRole(role), id } : userForRole(role);
  setMockUser(user);
  return bearerFor(user);
};

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
});

describe("route ordering", () => {
  it("does not treat /doubts/bookmarked as a doubt id", async () => {
    stub("doubtBookmark", "findMany").mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/students/doubts/bookmarked")
      .set(...as("STUDENT"));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("doubts");
    // getDoubtById would have gone looking for a doubt called "bookmarked".
    expect(stub("doubt", "findFirst")).not.toHaveBeenCalled();
  });

  it("does not treat /doubts/tags as a doubt id", async () => {
    stub("doubt", "findMany").mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/students/doubts/tags")
      .set(...as("STUDENT"));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("tags");
    expect(stub("doubt", "findFirst")).not.toHaveBeenCalled();
  });
});

describe("POST /doubts/:doubtId/bookmark", () => {
  it("saves a doubt", async () => {
    stub("doubt", "findUnique").mockResolvedValueOnce({ id: "doubt-1" });
    stub("doubtBookmark", "upsert").mockResolvedValueOnce({});

    const res = await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...as("STUDENT"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookmarked: true });
  });

  it("is idempotent — saving twice is 200, not 409", async () => {
    stub("doubt", "findUnique").mockResolvedValue({ id: "doubt-1" });
    stub("doubtBookmark", "upsert").mockResolvedValue({});

    const auth = as("STUDENT");
    const first = await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...auth);
    const second = await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...auth);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("uses upsert, so the unique index enforces one row", async () => {
    stub("doubt", "findUnique").mockResolvedValueOnce({ id: "doubt-1" });
    const upsert = stub("doubtBookmark", "upsert");
    upsert.mockResolvedValueOnce({});

    await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...as("STUDENT", "user-9"));

    expect(upsert.mock.calls[0]![0]).toMatchObject({
      where: { doubtId_userId: { doubtId: "doubt-1", userId: "user-9" } },
    });
  });

  it("404s for a doubt that does not exist", async () => {
    stub("doubt", "findUnique").mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/students/doubts/nope/bookmark")
      .set(...as("STUDENT"));

    expect(res.status).toBe(404);
  });

  it("is available to faculty, matching upvoteDoubt", async () => {
    stub("doubt", "findUnique").mockResolvedValueOnce({ id: "doubt-1" });
    stub("doubtBookmark", "upsert").mockResolvedValueOnce({});

    const res = await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...as("FACULTY"));

    expect(res.status).toBe(200);
  });

  it("is refused for an admin", async () => {
    const res = await request(app)
      .post("/api/students/doubts/doubt-1/bookmark")
      .set(...as("ADMIN"));

    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/students/doubts/doubt-1/bookmark");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /doubts/:doubtId/bookmark", () => {
  it("removes a save", async () => {
    stub("doubtBookmark", "deleteMany").mockResolvedValueOnce({ count: 1 });

    const res = await request(app)
      .delete("/api/students/doubts/doubt-1/bookmark")
      .set(...as("STUDENT"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookmarked: false });
  });

  it("is idempotent — removing one that is not there is 200", async () => {
    stub("doubtBookmark", "deleteMany").mockResolvedValueOnce({ count: 0 });

    const res = await request(app)
      .delete("/api/students/doubts/doubt-1/bookmark")
      .set(...as("STUDENT"));

    expect(res.status).toBe(200);
  });

  it("scopes the delete to the caller, so one user cannot unsave another's", async () => {
    const deleteMany = stub("doubtBookmark", "deleteMany");
    deleteMany.mockResolvedValueOnce({ count: 0 });

    await request(app)
      .delete("/api/students/doubts/doubt-1/bookmark")
      .set(...as("STUDENT", "user-7"));

    expect(deleteMany.mock.calls[0]![0]).toEqual({
      where: { doubtId: "doubt-1", userId: "user-7" },
    });
  });
});

describe("GET /doubts/bookmarked", () => {
  it("returns an empty list without a second query", async () => {
    stub("doubtBookmark", "findMany").mockResolvedValueOnce([]);
    const doubtFindMany = stub("doubt", "findMany");

    const res = await request(app)
      .get("/api/students/doubts/bookmarked")
      .set(...as("STUDENT"));

    expect(res.body).toEqual({ doubts: [] });
    expect(doubtFindMany).not.toHaveBeenCalled();
  });

  it("only ever queries the caller's own bookmarks", async () => {
    const findMany = stub("doubtBookmark", "findMany");
    findMany.mockResolvedValueOnce([]);

    await request(app)
      .get("/api/students/doubts/bookmarked")
      .set(...as("STUDENT", "user-3"));

    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: "user-3" },
    });
  });

  it("orders by when the doubt was saved, not when it was posted", async () => {
    const older = new Date("2026-09-01");
    const newer = new Date("2026-09-20");

    stub("doubtBookmark", "findMany").mockResolvedValueOnce([
      { doubtId: "b", savedAt: newer },
      { doubtId: "a", savedAt: older },
    ]);
    // Returned in the opposite order by the second query, on purpose.
    stub("doubt", "findMany").mockResolvedValueOnce([
      { id: "a", title: "older save" },
      { id: "b", title: "newer save" },
    ]);

    const res = await request(app)
      .get("/api/students/doubts/bookmarked")
      .set(...as("STUDENT"));

    expect(res.body.doubts.map((d: { id: string }) => d.id)).toEqual(["b", "a"]);
  });

  it("drops a bookmark whose doubt has since been deleted", async () => {
    stub("doubtBookmark", "findMany").mockResolvedValueOnce([
      { doubtId: "gone", savedAt: new Date() },
    ]);
    stub("doubt", "findMany").mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/students/doubts/bookmarked")
      .set(...as("STUDENT"));

    expect(res.body.doubts).toEqual([]);
  });
});
