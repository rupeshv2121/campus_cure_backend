/**
 * CC-10 backfill: embed doubts that predate the embedding pipeline.
 *
 * Idempotent (the unique constraint on the job queue makes re-enqueueing safe),
 * resumable, and rate-limit aware — it stops cleanly when the provider starts
 * refusing rather than burning the daily free-tier quota.
 *
 * Run from campus_cure_backend:
 *     npx tsx src/scripts/backfillEmbeddings.ts
 *
 * Safe to run more than once. Run it days before any demo, never the night
 * before: the free tier has a daily cap that only reveals itself as a 429.
 */
import "dotenv/config";
import { AI_ENABLED, EMBEDDING_BATCH_SIZE } from "../config/env.js";
import { prisma } from "../config/database.js";
import {
  enqueueEmbedding,
  findUnembeddedDoubtIds,
  getEmbeddingStats,
} from "../repositories/embeddingRepository.js";
import { runEmbeddingDrain } from "../services/ai/embeddingWorker.js";

const MAX_BATCHES = 200; // hard stop, so a bug cannot loop forever

const main = async () => {
  if (!AI_ENABLED) {
    console.error(
      "AI_ENABLED is false (or HF_API_TOKEN is unset). Nothing to do.",
    );
    process.exitCode = 1;
    return;
  }

  const before = await getEmbeddingStats();
  console.log(
    `Before: ${before.embedded}/${before.totalDoubts} doubts embedded ` +
      `(${before.pending} pending, ${before.failed} failed)`,
  );

  const ids = await findUnembeddedDoubtIds(10_000);
  if (ids.length === 0) {
    console.log("Every doubt already has an embedding. Nothing to do.");
    return;
  }

  console.log(`Enqueueing ${ids.length} doubt(s)...`);
  for (const id of ids) {
    await enqueueEmbedding("doubt", id);
  }

  console.log(`Draining in batches of ${EMBEDDING_BATCH_SIZE}...`);
  let batch = 0;
  let embedded = 0;

  while (batch < MAX_BATCHES) {
    batch++;
    const result = await runEmbeddingDrain();

    if (result.skipped) {
      console.error(`Stopped: ${result.reason}`);
      break;
    }
    if (result.claimed === 0) break;

    embedded += result.embedded;
    console.log(
      `  batch ${batch}: claimed ${result.claimed}, embedded ${result.embedded}, failed ${result.failed}`,
    );

    // Every job failing usually means the provider is refusing — most likely a
    // daily quota. Stop rather than burn attempts; the jobs stay PENDING and
    // the next run resumes from here.
    if (result.embedded === 0 && result.failed > 0) {
      console.error(
        "  every job in this batch failed — stopping. Jobs remain queued;\n" +
          "  re-run this script once the provider recovers.",
      );
      break;
    }
  }

  const after = await getEmbeddingStats();
  console.log(
    `\nAfter: ${after.embedded}/${after.totalDoubts} doubts embedded ` +
      `(${after.pending} pending, ${after.failed} failed)`,
  );
  console.log(`Embedded ${embedded} doubt(s) in this run.`);

  if (after.failed > 0) {
    console.log(
      `\n${after.failed} job(s) are parked as FAILED. Inspect with:\n` +
        `  SELECT "entityId", "attempts", "lastError" FROM "EmbeddingJob" WHERE "status" = 'FAILED';`,
    );
  }
};

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // config/database.ts holds a pg Pool with keep-alive enabled, which keeps
    // the event loop alive after the work is done. $disconnect() does not close
    // it, so a CLI script would otherwise hang for minutes after finishing.
    process.exit(process.exitCode ?? 0);
  });
