/**
 * The embedding worker.
 *
 * Embedding is asynchronous by design. HuggingFace cold starts take 20+ seconds
 * and Vercel functions have an execution limit, so calling the provider inline
 * would make posting a doubt slow, flaky and dependent on a third party. A
 * provider outage must never stop a student posting a doubt.
 *
 * See docs/specs/CC-10-embedding-infra.md.
 */
import { AI_ENABLED, EMBEDDING_BATCH_SIZE } from "../../config/env.js";
import {
  buildEmbeddingText,
  claimPendingJobs,
  enqueueEmbedding,
  getComplaintTexts,
  getDoubtTexts,
  markJobsDone,
  markJobsFailed,
  writeComplaintEmbedding,
  writeDoubtEmbedding,
  type EntityType,
  type PendingJob,
} from "../../repositories/embeddingRepository.js";
import { getEmbeddingProvider } from "./embeddings/index.js";

/**
 * Forces `markJobsFailed` to park a job immediately rather than retry it.
 * Used for conditions that can never succeed, such as a deleted entity.
 */
const MAX_ATTEMPTS_SENTINEL = 999;

/**
 * Per-entity wiring. Adding an entity to the pipeline means adding a row here,
 * not writing a second worker — which was the point of specifying CC-10
 * separately from the features that consume it.
 */
const HANDLERS: Record<
  string,
  {
    fetch: (ids: string[]) => Promise<Array<{ id: string; title: string; description: string }>>;
    write: (id: string, vector: number[], model: string) => Promise<void>;
  }
> = {
  doubt: { fetch: getDoubtTexts, write: writeDoubtEmbedding },
  complaint: { fetch: getComplaintTexts, write: writeComplaintEmbedding },
};

export interface DrainResult {
  claimed: number;
  embedded: number;
  failed: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Queue an entity for embedding. Never throws — a failure to enqueue must not
 * fail the user action that triggered it.
 */
export const requestEmbedding = async (
  entityType: EntityType,
  entityId: string,
): Promise<void> => {
  if (!AI_ENABLED) return;
  try {
    await enqueueEmbedding(entityType, entityId);
  } catch (error) {
    console.error(
      `[embedding] failed to enqueue ${entityType}:${entityId}`,
      (error as Error).message,
    );
  }
};

/**
 * Claim a batch of pending jobs, embed them in one provider call, and record
 * the outcome.
 *
 * Whole-batch failure is treated as retryable: the jobs go back to PENDING with
 * their attempt count raised, so a rate limit delays work rather than losing it.
 */
export const runEmbeddingDrain = async (
  batchSize: number = EMBEDDING_BATCH_SIZE,
): Promise<DrainResult> => {
  const base: DrainResult = {
    claimed: 0,
    embedded: 0,
    failed: 0,
    skipped: false,
  };

  if (!AI_ENABLED) {
    return { ...base, skipped: true, reason: "AI_ENABLED is false" };
  }

  const provider = getEmbeddingProvider();
  if (!provider) {
    return { ...base, skipped: true, reason: "no embedding provider configured" };
  }

  const jobs = await claimPendingJobs(batchSize);
  if (jobs.length === 0) return base;

  // Answers are not wired up yet (CC-12); those jobs are parked, not retried.
  const supported = jobs.filter((job) => HANDLERS[job.entityType]);
  const unsupported = jobs.filter((job) => !HANDLERS[job.entityType]);

  if (unsupported.length > 0) {
    await markJobsFailed(unsupported, "Unsupported entity type for CC-10");
  }

  if (supported.length === 0) {
    return { ...base, claimed: jobs.length, failed: unsupported.length };
  }

  // Fetch per entity type, so one batch can mix doubts and complaints.
  const byId = new Map<string, { id: string; title: string; description: string }>();
  for (const [entityType, handler] of Object.entries(HANDLERS)) {
    const ids = supported
      .filter((job) => job.entityType === entityType)
      .map((job) => job.entityId);
    if (ids.length === 0) continue;
    for (const row of await handler.fetch(ids)) byId.set(row.id, row);
  }

  // A job whose row has since been deleted can never succeed — park it now
  // rather than retrying it five times.
  const orphaned = supported.filter((job) => !byId.has(job.entityId));
  const live = supported.filter((job) => byId.has(job.entityId));

  if (orphaned.length > 0) {
    await markJobsFailed(
      orphaned.map((job) => ({ id: job.id, attempts: MAX_ATTEMPTS_SENTINEL })),
      "Entity no longer exists",
    );
  }

  if (live.length === 0) {
    return {
      ...base,
      claimed: jobs.length,
      failed: unsupported.length + orphaned.length,
    };
  }

  const inputs = live.map((job) => buildEmbeddingText(byId.get(job.entityId)!));

  let vectors: number[][];
  try {
    vectors = await provider.embed(inputs);
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[embedding] provider failed for ${live.length} job(s):`, message);
    await markJobsFailed(live, message);
    return {
      ...base,
      claimed: jobs.length,
      failed: live.length + unsupported.length + orphaned.length,
    };
  }

  const succeeded: string[] = [];
  const errored: PendingJob[] = [];

  for (const [index, job] of live.entries()) {
    const vector = vectors[index];
    if (!vector) {
      errored.push(job);
      continue;
    }
    try {
      await HANDLERS[job.entityType]!.write(job.entityId, vector, provider.model);
      succeeded.push(job.id);
    } catch (error) {
      console.error(
        `[embedding] failed to persist ${job.entityId}:`,
        (error as Error).message,
      );
      errored.push(job);
    }
  }

  await markJobsDone(succeeded);
  if (errored.length > 0) {
    await markJobsFailed(errored, "Failed to persist embedding");
  }

  return {
    claimed: jobs.length,
    embedded: succeeded.length,
    failed: errored.length + unsupported.length + orphaned.length,
    skipped: false,
  };
};

/**
 * Fire-and-forget drain, for use straight after a write so the common case is
 * fast rather than waiting for the next cron tick. Deliberately swallows
 * everything: this must never affect the response the user receives.
 */
export const triggerDrainInBackground = (): void => {
  if (!AI_ENABLED) return;
  void runEmbeddingDrain().catch((error) => {
    console.error("[embedding] background drain failed:", (error as Error).message);
  });
};
