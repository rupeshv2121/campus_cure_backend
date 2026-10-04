/**
 * Vote counting fixes (2026-10-04).
 *
 * Doubt.upVoteCount is the number on the "Upvote this doubt" button. Votes on
 * the doubt's ANSWERS used to be added to it as well, inflating it. And a
 * double tap on either button answered 500 for the losing request.
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
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[model]![method]!;

const student = userForRole("STUDENT");
let ip = 0;
const post = (path: string) =>
  request(app).post(path).set(...bearerFor(student)).set("X-Forwarded-For", `10.8.0.${++ip}`);

const QUEUED: Array<[string, string]> = [
  ["answer", "findUnique"],
  ["answer", "update"],
  ["answerUpvote", "findUnique"],
  ["answerUpvote", "create"],
  ["answerUpvote", "delete"],
  ["doubt", "findUnique"],
  ["doubt", "update"],
  ["doubtUpvote", "findUnique"],
  ["doubtUpvote", "create"],
];
const defaults = new Map(QUEUED.map(([m, f]) => [`${m}.${f}`, stub(m, f).getMockImplementation()]));

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
  for (const [m, f] of QUEUED) {
    const fn = stub(m, f);
    fn.mockReset();
    const impl = defaults.get(`${m}.${f}`);
    if (impl) fn.mockImplementation(impl);
  }
  setMockUser(student);
});

describe("answer upvotes", () => {
  it("count on the answer, and never on the doubt", async () => {
    stub("answer", "findUnique").mockResolvedValueOnce({ id: "a1" });
    stub("answerUpvote", "findUnique").mockResolvedValueOnce(null);
    stub("answer", "update").mockResolvedValueOnce({ id: "a1", answeredById: "author", doubtId: "d1", upvotes: 1 });

    const res = await post("/api/students/answers/a1/upvote");

    expect(res.status).toBe(200);
    expect(res.body.isUpvoted).toBe(true);
    expect(stub("answerUpvote", "create")).toHaveBeenCalled();
    expect(stub("answer", "update")).toHaveBeenCalledWith(
      expect.objectContaining({ data: { upvotes: { increment: 1 } } }),
    );
    expect(stub("doubt", "update")).not.toHaveBeenCalled();
  });

  it("answer 404 for an answer that does not exist", async () => {
    stub("answer", "findUnique").mockResolvedValueOnce(null);
    const res = await post("/api/students/answers/missing/upvote");
    expect(res.status).toBe(404);
  });

  it("answer a double tap with the current state, not a 500", async () => {
    stub("answer", "findUnique")
      .mockResolvedValueOnce({ id: "a1" })
      .mockResolvedValueOnce({ id: "a1", upvotes: 1 });
    stub("answerUpvote", "findUnique").mockResolvedValueOnce(null);
    stub("answerUpvote", "create").mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await post("/api/students/answers/a1/upvote");

    expect(res.status).toBe(200);
    expect(res.body.isUpvoted).toBe(true);
  });
});

describe("doubt upvotes", () => {
  it("answer a double tap with the current state, not a 500", async () => {
    stub("doubt", "findUnique")
      .mockResolvedValueOnce({ id: "d1", postedById: "asker" })
      .mockResolvedValueOnce({ upVoteCount: 3 });
    stub("doubtUpvote", "findUnique").mockResolvedValueOnce(null);
    stub("doubtUpvote", "create").mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await post("/api/students/doubts/d1/upvote");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isUpvoted: true, upVoteCount: 3 });
  });
});
