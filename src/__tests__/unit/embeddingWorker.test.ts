/**
 * CC-10: the embedding worker.
 *
 * The repository and provider are mocked, so these assert the worker's job
 * bookkeeping — which is where the important guarantees live: a provider
 * outage must lose no work, and a job that can never succeed must not be
 * retried five times.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  claimPendingJobs: vi.fn(),
  getDoubtTexts: vi.fn(),
  writeDoubtEmbedding: vi.fn(),
  markJobsDone: vi.fn(),
  markJobsFailed: vi.fn(),
  enqueueEmbedding: vi.fn(),
  buildEmbeddingText: (d: { title: string; description: string }) =>
    `${d.title}\n${d.description}`,
}));

const providerRef = vi.hoisted(() => ({
  current: null as null | { model: string; dimensions: number; embed: ReturnType<typeof vi.fn> },
}));

// AI_ENABLED is derived from HF_API_TOKEN at import time, and the test setup
// deliberately provides no token — a global fake would make OTHER tests fire
// real network calls through the background drain. So force it on here only.
vi.mock("../../config/env.js", () => ({
  AI_ENABLED: true,
  EMBEDDING_BATCH_SIZE: 50,
}));

vi.mock("../../repositories/embeddingRepository.js", () => repo);
vi.mock("../../services/ai/embeddings/index.js", () => ({
  getEmbeddingProvider: () => providerRef.current,
}));

import { runEmbeddingDrain } from "../../services/ai/embeddingWorker.js";

const job = (id: string, entityId: string, attempts = 0) => ({
  id,
  entityType: "doubt",
  entityId,
  attempts,
});

const doubt = (id: string) => ({
  id,
  title: `Title ${id}`,
  description: `Description ${id}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  providerRef.current = {
    model: "sentence-transformers/all-MiniLM-L6-v2",
    dimensions: 384,
    embed: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
  };
});

describe("runEmbeddingDrain", () => {
  it("does nothing when the queue is empty", async () => {
    repo.claimPendingJobs.mockResolvedValue([]);

    const result = await runEmbeddingDrain();

    expect(result).toMatchObject({ claimed: 0, embedded: 0, failed: 0 });
    expect(providerRef.current!.embed).not.toHaveBeenCalled();
  });

  it("skips cleanly when no provider is configured", async () => {
    providerRef.current = null;

    const result = await runEmbeddingDrain();

    expect(result.skipped).toBe(true);
    expect(repo.claimPendingJobs).not.toHaveBeenCalled();
  });

  it("embeds a batch in a single provider call and marks the jobs done", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1"), job("j2", "d2")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1"), doubt("d2")]);

    const result = await runEmbeddingDrain();

    expect(providerRef.current!.embed).toHaveBeenCalledTimes(1);
    expect(providerRef.current!.embed).toHaveBeenCalledWith([
      "Title d1\nDescription d1",
      "Title d2\nDescription d2",
    ]);
    expect(repo.writeDoubtEmbedding).toHaveBeenCalledTimes(2);
    expect(repo.markJobsDone).toHaveBeenCalledWith(["j1", "j2"]);
    expect(result).toMatchObject({ claimed: 2, embedded: 2, failed: 0 });
  });

  it("tags every written vector with the provider's model", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1")]);

    await runEmbeddingDrain();

    expect(repo.writeDoubtEmbedding).toHaveBeenCalledWith(
      "d1",
      [0.1, 0.2],
      "sentence-transformers/all-MiniLM-L6-v2",
    );
  });

  /**
   * The central resilience guarantee: a rate limit or outage must delay work,
   * never lose it. Jobs go back to the queue rather than being marked done.
   */
  it("returns jobs to the queue when the provider fails", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1"), job("j2", "d2")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1"), doubt("d2")]);
    providerRef.current!.embed.mockRejectedValue(new Error("429 Too Many Requests"));

    const result = await runEmbeddingDrain();

    expect(repo.markJobsDone).not.toHaveBeenCalled();
    expect(repo.markJobsFailed).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "j1" })]),
      expect.stringContaining("429"),
    );
    expect(result).toMatchObject({ embedded: 0, failed: 2 });
  });

  it("writes no embedding at all when the provider fails", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1")]);
    providerRef.current!.embed.mockRejectedValue(new Error("boom"));

    await runEmbeddingDrain();

    expect(repo.writeDoubtEmbedding).not.toHaveBeenCalled();
  });

  it("parks a job whose entity no longer exists instead of retrying it", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "deleted")]);
    repo.getDoubtTexts.mockResolvedValue([]); // row is gone

    const result = await runEmbeddingDrain();

    expect(providerRef.current!.embed).not.toHaveBeenCalled();
    expect(repo.markJobsFailed).toHaveBeenCalledWith(
      // attempts is forced high so it is parked immediately, not retried
      [expect.objectContaining({ id: "j1", attempts: expect.any(Number) })],
      "Entity no longer exists",
    );
    expect(result.failed).toBe(1);
  });

  it("still processes live jobs when one entity in the batch is missing", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1"), job("j2", "gone")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1")]);

    const result = await runEmbeddingDrain();

    expect(providerRef.current!.embed).toHaveBeenCalledWith(["Title d1\nDescription d1"]);
    expect(repo.markJobsDone).toHaveBeenCalledWith(["j1"]);
    expect(result).toMatchObject({ embedded: 1, failed: 1 });
  });

  it("parks jobs for entity types this spec does not handle", async () => {
    repo.claimPendingJobs.mockResolvedValue([
      { id: "j1", entityType: "complaint", entityId: "c1", attempts: 0 },
    ]);

    const result = await runEmbeddingDrain();

    expect(repo.markJobsFailed).toHaveBeenCalledWith(
      expect.anything(),
      "Unsupported entity type for CC-10",
    );
    expect(result.failed).toBe(1);
  });

  it("marks a job failed when persistence fails, without losing the others", async () => {
    repo.claimPendingJobs.mockResolvedValue([job("j1", "d1"), job("j2", "d2")]);
    repo.getDoubtTexts.mockResolvedValue([doubt("d1"), doubt("d2")]);
    repo.writeDoubtEmbedding
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("db down"));

    const result = await runEmbeddingDrain();

    expect(repo.markJobsDone).toHaveBeenCalledWith(["j1"]);
    expect(result).toMatchObject({ embedded: 1, failed: 1 });
  });
});
