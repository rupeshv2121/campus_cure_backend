/**
 * CC-15: chatbot tools and loop.
 *
 * The tests that matter are the authorization ones. Everything else about this
 * feature is a convenience; the scoping is the part that, if wrong, leaks one
 * student's records to another.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    complaint: { findMany: vi.fn() },
    doubt: { findMany: vi.fn() },
    answer: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
  },
}));
const search = vi.hoisted(() => ({ hybridSearchDoubts: vi.fn() }));

vi.mock("../../config/database.js", () => db);
vi.mock("../../services/search/hybridSearch.js", () => search);

import {
  assertNoIdentityParameters,
  buildStudentTools,
  FORBIDDEN_PARAM_NAMES,
  type ToolDefinition,
} from "../../services/ai/chat/tools.js";

const USER = "user-being-helped";
const OTHER = "someone-else";

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(db.prisma)) {
    model.findMany.mockResolvedValue([]);
  }
  search.hybridSearchDoubts.mockResolvedValue({ doubts: [], used: [], degraded: false });
});

describe("tool schemas", () => {
  const { definitions } = buildStudentTools(USER);

  /**
   * The central guarantee. If no tool accepts an identity, the model cannot
   * express a request for another user's data — no matter what it is told.
   */
  it("declare no identity parameter of any kind", () => {
    for (const definition of definitions) {
      const params = Object.keys(definition.function.parameters.properties);
      for (const param of params) {
        expect(FORBIDDEN_PARAM_NAMES).not.toContain(param.toLowerCase());
      }
    }
  });

  it("are rejected at construction if one is ever added", () => {
    const bad: ToolDefinition[] = [
      {
        type: "function",
        function: {
          name: "getComplaintsFor",
          description: "…",
          parameters: {
            type: "object",
            properties: { userId: { type: "string" } },
          },
        },
      },
    ];

    expect(() => assertNoIdentityParameters(bad)).toThrow(/identity parameter/i);
  });

  it("expose only read-only lookups", () => {
    const names = definitions.map((d) => d.function.name);
    // A misunderstood instruction that files a complaint is far worse than one
    // that answers a question wrongly.
    for (const name of names) {
      expect(name).not.toMatch(/create|update|delete|post|raise|submit|assign/i);
    }
  });
});

describe("tool handlers scope every query to the caller", () => {
  const { handlers } = buildStudentTools(USER);

  it("getMyComplaints filters by raisedById", async () => {
    await handlers.getMyComplaints!({});
    expect(db.prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ raisedById: USER }),
      }),
    );
  });

  it("getMyDoubts filters by postedById", async () => {
    await handlers.getMyDoubts!({});
    expect(db.prisma.doubt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ postedById: USER }),
      }),
    );
  });

  it("getMyAnswers filters by answeredById", async () => {
    await handlers.getMyAnswers!({});
    expect(db.prisma.answer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ answeredById: USER }),
      }),
    );
  });

  it("getMyNotifications filters by userId", async () => {
    await handlers.getMyNotifications!({});
    expect(db.prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER, read: false }),
      }),
    );
  });

  /**
   * Prompt injection made concrete. Even if the model is fully compromised and
   * passes another user's id as an argument, the argument is ignored — scoping
   * is in the closure, not the payload.
   */
  it("ignores an injected identity argument entirely", async () => {
    await handlers.getMyComplaints!({
      userId: OTHER,
      raisedById: OTHER,
      status: "RAISED",
    });

    const call = db.prisma.complaint.findMany.mock.calls[0]![0];
    expect(call.where.raisedById).toBe(USER);
    // Nothing the model supplied reaches the query at all — getMyComplaints
    // takes no arguments, so there is no path from payload to WHERE clause.
    expect(JSON.stringify(call.where)).not.toContain(OTHER);
    expect(call.where).toEqual({ raisedById: USER });
  });

  it("every tool ignores extra arguments it did not declare", async () => {
    const injected = { userId: OTHER, raisedById: OTHER, postedById: OTHER };

    for (const name of [
      "getMyComplaints",
      "getMyDoubts",
      "getMyAnswers",
      "getMyNotifications",
    ]) {
      await handlers[name]!(injected);
    }

    for (const model of [
      db.prisma.complaint,
      db.prisma.doubt,
      db.prisma.answer,
      db.prisma.notification,
    ]) {
      const where = model.findMany.mock.calls[0]![0].where;
      expect(JSON.stringify(where)).not.toContain(OTHER);
      expect(JSON.stringify(where)).toContain(USER);
    }
  });

  it("binds a different caller to a different scope", async () => {
    const other = buildStudentTools(OTHER);
    await other.handlers.getMyComplaints!({});

    expect(db.prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ raisedById: OTHER }),
      }),
    );
  });

  it("searchDoubts returns no author information", async () => {
    search.hybridSearchDoubts.mockResolvedValue({
      doubts: [
        {
          id: "d1",
          title: "Binary search",
          subject: "DSA",
          description: "x",
          semester: 3,
          views: 1,
          createdAt: new Date(),
          _count: { answers: 2 },
          matchedKeywords: [],
        },
      ],
      used: ["vector"],
      degraded: false,
    });

    const result = (await handlers.searchDoubts!({ query: "binary search" })) as
      Array<Record<string, unknown>>;

    // Public data, but it must not become a way to profile who asked what.
    expect(Object.keys(result[0]!)).toEqual(["title", "subject", "answers"]);
  });

  it("does not search on a too-short query", async () => {
    await handlers.searchDoubts!({ query: "a" });
    expect(search.hybridSearchDoubts).not.toHaveBeenCalled();
  });
});
