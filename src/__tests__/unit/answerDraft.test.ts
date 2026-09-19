/**
 * CC-12: AI answer draft generation.
 *
 * The guarantees that matter are the ones that stop this feature doing harm:
 * no draft without grounding, and no empty draft ever stored.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({ completeWithFallback: vi.fn() }));
const search = vi.hoisted(() => ({ hybridSearchDoubts: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: {
    doubt: { findMany: vi.fn() },
    answer: { findMany: vi.fn() },
    answerDraft: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("../../services/ai/chat/index.js", () => chat);
vi.mock("../../services/search/hybridSearch.js", () => search);
vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => ({
  AI_ENABLED: true,
  DRAFT_DELAY_HOURS: 24,
}));

import {
  generateDraftForDoubt,
  runDraftGeneration,
} from "../../services/ai/answerDraft.js";

const doubt = {
  id: "d1",
  title: "How do hash tables handle collisions?",
  description: "Confused between chaining and open addressing.",
  subject: "DSA",
};

const groundingAnswer = (id: string) => ({
  id,
  content: `Approved answer ${id} about collision handling.`,
  isVerified: true,
  upvotes: 3,
  doubt: { title: "Hash table collisions" },
});

beforeEach(() => {
  vi.clearAllMocks();
  search.hybridSearchDoubts.mockResolvedValue({
    doubts: [{ id: "d2" }, { id: "d3" }],
    used: ["vector"],
    degraded: false,
  });
  db.prisma.answer.findMany.mockResolvedValue([groundingAnswer("a1")]);
  chat.completeWithFallback.mockResolvedValue({
    content: "Collisions are handled by chaining or open addressing.",
    provider: "groq",
    model: "openai/gpt-oss-120b",
  });
  db.prisma.answerDraft.upsert.mockResolvedValue({});
  db.prisma.answerDraft.findMany.mockResolvedValue([]);
});

describe("generateDraftForDoubt", () => {
  it("stores a draft grounded in approved answers", async () => {
    const result = await generateDraftForDoubt(doubt);

    expect(result.created).toBe(true);
    expect(db.prisma.answerDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          doubtId: "d1",
          sourceIds: ["a1"],
          model: "groq/openai/gpt-oss-120b",
        }),
      }),
    );
  });

  it("only grounds on APPROVED answers", async () => {
    await generateDraftForDoubt(doubt);

    expect(db.prisma.answer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ approvalStatus: "APPROVED" }),
      }),
    );
  });

  it("excludes the doubt itself from its own grounding", async () => {
    await generateDraftForDoubt(doubt);

    expect(search.hybridSearchDoubts).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ excludeId: "d1" }),
    );
  });

  /**
   * The defining rule of this spec. A grounded-answer feature that
   * free-generates when it finds no grounding is just free generation.
   */
  describe("no grounding means no draft", () => {
    it("does not generate when retrieval returns nothing", async () => {
      search.hybridSearchDoubts.mockResolvedValue({
        doubts: [],
        used: [],
        degraded: false,
      });

      const result = await generateDraftForDoubt(doubt);

      expect(result.created).toBe(false);
      expect(chat.completeWithFallback).not.toHaveBeenCalled();
      expect(db.prisma.answerDraft.upsert).not.toHaveBeenCalled();
    });

    it("does not generate when similar doubts have no approved answers", async () => {
      db.prisma.answer.findMany.mockResolvedValue([]);

      const result = await generateDraftForDoubt(doubt);

      expect(result.created).toBe(false);
      expect(result.reason).toMatch(/no grounding/i);
      expect(chat.completeWithFallback).not.toHaveBeenCalled();
    });
  });

  describe("never stores a non-answer", () => {
    it("stores nothing when every provider fails", async () => {
      chat.completeWithFallback.mockResolvedValue(null);

      const result = await generateDraftForDoubt(doubt);

      expect(result.created).toBe(false);
      expect(db.prisma.answerDraft.upsert).not.toHaveBeenCalled();
    });

    it("stores nothing when the model returns whitespace", async () => {
      chat.completeWithFallback.mockResolvedValue({
        content: "   \n  ",
        provider: "groq",
        model: "m",
      });

      const result = await generateDraftForDoubt(doubt);

      expect(result.created).toBe(false);
      expect(db.prisma.answerDraft.upsert).not.toHaveBeenCalled();
    });
  });

  it("never throws, whatever fails underneath", async () => {
    search.hybridSearchDoubts.mockRejectedValue(new Error("db down"));

    await expect(generateDraftForDoubt(doubt)).resolves.toMatchObject({
      created: false,
    });
  });

  it("sends the grounding material to the model", async () => {
    await generateDraftForDoubt(doubt);

    const messages = chat.completeWithFallback.mock.calls[0]![0];
    const userPrompt = messages[1].content;
    expect(userPrompt).toContain("Approved answer a1");
    expect(userPrompt).toContain(doubt.title);
  });

  it("budgets enough tokens for a reasoning model to produce content", async () => {
    await generateDraftForDoubt(doubt);

    const options = chat.completeWithFallback.mock.calls[0]![1];
    // gpt-oss spends part of this on reasoning before writing anything; a small
    // budget silently yields empty content.
    expect(options.maxTokens).toBeGreaterThanOrEqual(1000);
  });
});

describe("runDraftGeneration", () => {
  it("reports how many were skipped for lack of grounding", async () => {
    db.prisma.doubt.findMany.mockResolvedValue([
      doubt,
      { ...doubt, id: "d9", title: "Unrelated" },
    ]);
    search.hybridSearchDoubts
      .mockResolvedValueOnce({ doubts: [{ id: "d2" }], used: [], degraded: false })
      .mockResolvedValueOnce({ doubts: [], used: [], degraded: false });

    const result = await runDraftGeneration(5);

    expect(result).toEqual({ considered: 2, created: 1, skipped: 1 });
  });

  it("only considers doubts with no answers at all", async () => {
    db.prisma.doubt.findMany.mockResolvedValue([]);

    await runDraftGeneration(5);

    expect(db.prisma.doubt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ answers: { none: {} } }),
      }),
    );
  });
});
