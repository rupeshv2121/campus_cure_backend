/**
 * All vector SQL lives here, and nowhere else.
 *
 * Prisma cannot type `vector`, so the column is declared `Unsupported(...)` in
 * the schema and is invisible to the typed client — every read and write has to
 * go through raw SQL. Confining that to one module is what stops raw SQL
 * leaking into controllers. See docs/specs/CC-10-embedding-infra.md.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { EMBEDDING_DIMENSIONS, HF_EMBEDDING_MODEL } from "../config/env.js";

export type EntityType = "doubt" | "complaint" | "answer";

export interface PendingJob {
  id: string;
  entityType: string;
  entityId: string;
  attempts: number;
}

export interface SimilarDoubt {
  id: string;
  distance: number;
}

/** Jobs that have failed this many times are parked for inspection. */
export const MAX_JOB_ATTEMPTS = 5;

/**
 * pgvector's text input format. Passed as a bound parameter and cast with
 * `::vector` — never string-interpolated into the statement.
 */
const toVectorLiteral = (vector: number[]): string => `[${vector.join(",")}]`;

/**
 * Guard against the single worst failure mode in this subsystem: writing a
 * vector produced by a different model. Nothing would error — writes succeed,
 * queries return rows — and every result would be meaningless.
 */
const assertWritable = (vector: number[], model: string): void => {
  if (model !== HF_EMBEDDING_MODEL) {
    throw new Error(
      `Refusing to write an embedding from model "${model}"; the canonical ` +
        `model is "${HF_EMBEDDING_MODEL}". Changing models requires a full backfill.`,
    );
  }
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Refusing to write a ${vector.length}-dimension vector; expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }
};

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export const writeDoubtEmbedding = async (
  doubtId: string,
  vector: number[],
  model: string,
): Promise<void> => {
  assertWritable(vector, model);

  await prisma.$executeRaw`
    UPDATE "Doubt"
       SET "embedding"      = ${toVectorLiteral(vector)}::vector,
           "embeddingModel" = ${model},
           "embeddedAt"     = NOW()
     WHERE "id" = ${doubtId}
  `;
};

export const writeComplaintEmbedding = async (
  complaintId: string,
  vector: number[],
  model: string,
): Promise<void> => {
  assertWritable(vector, model);

  await prisma.$executeRaw`
    UPDATE "Complaint"
       SET "embedding"      = ${toVectorLiteral(vector)}::vector,
           "embeddingModel" = ${model},
           "embeddedAt"     = NOW()
     WHERE "id" = ${complaintId}
  `;
};

/* ------------------------------------------------------------------ *
 * Similarity search
 * ------------------------------------------------------------------ */

/**
 * Nearest neighbours by cosine distance, smallest first.
 *
 * Filters sit in the same WHERE clause as the vector scan so the planner can
 * combine them — this is the main reason vectors live in Postgres rather than
 * an external store.
 */
export const findSimilarDoubts = async (
  vector: number[],
  options: {
    limit?: number;
    subject?: string | undefined;
    semester?: number | undefined;
    excludeId?: string | undefined;
  } = {},
): Promise<SimilarDoubt[]> => {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Query vector has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);

  const rows = await prisma.$queryRaw<Array<{ id: string; distance: number }>>`
    SELECT "id",
           "embedding" <=> ${toVectorLiteral(vector)}::vector AS distance
      FROM "Doubt"
     WHERE "embedding" IS NOT NULL
       AND (${options.subject ?? null}::text IS NULL OR "subject" = ${options.subject ?? null})
       AND (${options.semester ?? null}::int  IS NULL OR "semester" = ${options.semester ?? null})
       AND (${options.excludeId ?? null}::text IS NULL OR "id" <> ${options.excludeId ?? null})
     ORDER BY distance
     LIMIT ${limit}
  `;

  // The driver may hand back Decimal/string for a float8 depending on adapter.
  return rows.map((row) => ({ id: row.id, distance: Number(row.distance) }));
};

export interface SimilarComplaint {
  id: string;
  distance: number;
  title: string;
  status: string;
  createdAt: Date;
}

/**
 * Candidate duplicate complaints — CC-13.
 *
 * Location is an exact filter rather than part of the similarity score,
 * because a fault is physical: "fan not working" in ML02 and the same words in
 * NL28 are two different faults, and text similarity alone cannot tell them
 * apart. Resolved complaints are excluded — if the fault recurred, that is a
 * new problem, not a duplicate.
 */
export const findSimilarComplaints = async (
  vector: number[],
  options: {
    block: string;
    classroomNumber: string;
    limit?: number;
    maxDistance?: number;
    excludeId?: string | undefined;
  },
): Promise<SimilarComplaint[]> => {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Query vector has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }

  const limit = Math.min(Math.max(options.limit ?? 3, 1), 20);
  const maxDistance = options.maxDistance ?? 1;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      distance: number;
      title: string;
      status: string;
      createdAt: Date;
    }>
  >`
    SELECT "id",
           "embedding" <=> ${toVectorLiteral(vector)}::vector AS distance,
           "title",
           "status"::text AS status,
           "createdAt"
      FROM "Complaint"
     WHERE "embedding" IS NOT NULL
       AND "block" = ${options.block}
       AND "classroomNumber" = ${options.classroomNumber}
       AND "status" <> 'RESOLVED'
       AND (${options.excludeId ?? null}::text IS NULL OR "id" <> ${options.excludeId ?? null})
       AND ("embedding" <=> ${toVectorLiteral(vector)}::vector) <= ${maxDistance}
     ORDER BY distance
     LIMIT ${limit}
  `;

  return rows.map((row) => ({ ...row, distance: Number(row.distance) }));
};

export interface DuplicatePair {
  aId: string;
  bId: string;
  similarity: number;
}

/**
 * All candidate duplicate pairs among open complaints — CC-13 admin view.
 *
 * A self-join constrained to the same room, so the comparison is only ever
 * within a location rather than across the whole table. `a."id" < b."id"`
 * yields each pair once rather than twice.
 */
export const findDuplicateComplaintPairs = async (
  maxDistance: number,
  limit = 500,
): Promise<DuplicatePair[]> => {
  const rows = await prisma.$queryRaw<
    Array<{ aId: string; bId: string; distance: number }>
  >`
    SELECT a."id" AS "aId",
           b."id" AS "bId",
           a."embedding" <=> b."embedding" AS distance
      FROM "Complaint" a
      JOIN "Complaint" b
        ON a."id" < b."id"
       AND a."block" = b."block"
       AND a."classroomNumber" = b."classroomNumber"
     WHERE a."embedding" IS NOT NULL
       AND b."embedding" IS NOT NULL
       AND a."status" <> 'RESOLVED'
       AND b."status" <> 'RESOLVED'
       AND (a."embedding" <=> b."embedding") <= ${maxDistance}
     ORDER BY distance
     LIMIT ${limit}
  `;

  return rows.map((row) => ({
    aId: row.aId,
    bId: row.bId,
    similarity: Number((1 - Number(row.distance)).toFixed(4)),
  }));
};

/**
 * Doubts similar to a given doubt, using its ALREADY-STORED embedding.
 *
 * Costs no provider call, unlike embedding the text again, and applies a
 * distance ceiling — which is what CC-12 needs. Search can rank loosely related
 * results and let the user judge; grounding cannot, because irrelevant
 * grounding produces a draft that says "the reference material does not cover
 * this", wasting a reviewer's time.
 */
export const findSimilarDoubtsToDoubt = async (
  doubtId: string,
  options: { limit?: number; maxDistance?: number; subject?: string | undefined } = {},
): Promise<SimilarDoubt[]> => {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);
  const maxDistance = options.maxDistance ?? 1;

  const rows = await prisma.$queryRaw<Array<{ id: string; distance: number }>>`
    SELECT b."id",
           a."embedding" <=> b."embedding" AS distance
      FROM "Doubt" a
      JOIN "Doubt" b ON b."id" <> a."id"
     WHERE a."id" = ${doubtId}
       AND a."embedding" IS NOT NULL
       AND b."embedding" IS NOT NULL
       AND (${options.subject ?? null}::text IS NULL OR b."subject" = ${options.subject ?? null})
       AND (a."embedding" <=> b."embedding") <= ${maxDistance}
     ORDER BY distance
     LIMIT ${limit}
  `;

  return rows.map((row) => ({ id: row.id, distance: Number(row.distance) }));
};

/* ------------------------------------------------------------------ *
 * Job queue
 * ------------------------------------------------------------------ */

/**
 * Queue an entity for embedding. Idempotent: the unique constraint on
 * (entityType, entityId) means re-enqueueing an existing job resets it to
 * PENDING rather than creating a duplicate.
 *
 * `tx` lets the caller enqueue inside the same transaction as the insert that
 * created the entity.
 */
export const enqueueEmbedding = async (
  entityType: EntityType,
  entityId: string,
  tx: Pick<typeof prisma, "$executeRaw"> = prisma,
): Promise<void> => {
  await tx.$executeRaw`
    INSERT INTO "EmbeddingJob" ("id", "entityType", "entityId", "status", "attempts", "updatedAt")
    VALUES (gen_random_uuid()::text, ${entityType}, ${entityId}, 'PENDING', 0, NOW())
    ON CONFLICT ("entityType", "entityId")
    DO UPDATE SET "status" = 'PENDING', "attempts" = 0, "updatedAt" = NOW()
  `;
};

/**
 * Atomically claim up to `limit` pending jobs.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes two concurrent cron invocations safe:
 * the second skips rows the first has locked instead of double-processing them.
 */
export const claimPendingJobs = async (limit: number): Promise<PendingJob[]> => {
  const rows = await prisma.$queryRaw<PendingJob[]>`
    UPDATE "EmbeddingJob"
       SET "status" = 'PROCESSING', "updatedAt" = NOW()
     WHERE "id" IN (
       SELECT "id" FROM "EmbeddingJob"
        WHERE "status" = 'PENDING'
        ORDER BY "createdAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
     RETURNING "id", "entityType", "entityId", "attempts"
  `;
  return rows;
};

export const markJobsDone = async (jobIds: string[]): Promise<void> => {
  if (jobIds.length === 0) return;
  await prisma.$executeRaw`
    UPDATE "EmbeddingJob"
       SET "status" = 'DONE', "lastError" = NULL, "updatedAt" = NOW()
     WHERE "id" = ANY(${jobIds}::text[])
  `;
};

/**
 * Return jobs to the queue with the attempt count incremented, or park them as
 * FAILED once they have exhausted their attempts. Failed jobs are left in place
 * for inspection rather than silently dropped.
 */
export const markJobsFailed = async (
  jobs: Array<{ id: string; attempts: number }>,
  error: string,
): Promise<void> => {
  if (jobs.length === 0) return;

  const exhausted = jobs
    .filter((job) => job.attempts + 1 >= MAX_JOB_ATTEMPTS)
    .map((job) => job.id);
  const retryable = jobs
    .filter((job) => job.attempts + 1 < MAX_JOB_ATTEMPTS)
    .map((job) => job.id);

  const message = error.slice(0, 500);

  if (retryable.length > 0) {
    await prisma.$executeRaw`
      UPDATE "EmbeddingJob"
         SET "status" = 'PENDING',
             "attempts" = "attempts" + 1,
             "lastError" = ${message},
             "updatedAt" = NOW()
       WHERE "id" = ANY(${retryable}::text[])
    `;
  }

  if (exhausted.length > 0) {
    await prisma.$executeRaw`
      UPDATE "EmbeddingJob"
         SET "status" = 'FAILED',
             "attempts" = "attempts" + 1,
             "lastError" = ${message},
             "updatedAt" = NOW()
       WHERE "id" = ANY(${exhausted}::text[])
    `;
  }
};

/* ------------------------------------------------------------------ *
 * Source text
 * ------------------------------------------------------------------ */

export interface DoubtText {
  id: string;
  title: string;
  description: string;
}

/** Fetch the text to embed for a set of doubts. */
export const getDoubtTexts = async (ids: string[]): Promise<DoubtText[]> => {
  if (ids.length === 0) return [];
  return prisma.doubt.findMany({
    where: { id: { in: ids } },
    // Explicit select: never pull `embedding` into application memory.
    select: { id: true, title: true, description: true },
  });
};

/**
 * Title and description together, capped well inside the model's 256-token
 * window. Whether description helps is CC-11's first experiment.
 */
export const buildEmbeddingText = (doubt: DoubtText): string =>
  `${doubt.title}\n${doubt.description}`.slice(0, 2000);

export interface ComplaintText {
  id: string;
  title: string;
  description: string;
}

export const getComplaintTexts = async (
  ids: string[],
): Promise<ComplaintText[]> => {
  if (ids.length === 0) return [];
  return prisma.complaint.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, description: true },
  });
};

/** Complaint ids with no embedding yet. */
export const findUnembeddedComplaintIds = async (
  limit: number,
): Promise<string[]> => {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Complaint"
     WHERE "embedding" IS NULL
     ORDER BY "createdAt" DESC
     LIMIT ${limit}
  `;
  return rows.map((row) => row.id);
};

/** Doubt ids with no embedding yet — drives the backfill. */
export const findUnembeddedDoubtIds = async (
  limit: number,
): Promise<string[]> => {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Doubt"
     WHERE "embedding" IS NULL
     ORDER BY "createdAt" DESC
     LIMIT ${limit}
  `;
  return rows.map((row) => row.id);
};

/** Counts for the admin/ops view and for verifying a backfill. */
export const getEmbeddingStats = async (): Promise<{
  totalDoubts: number;
  embedded: number;
  totalComplaints: number;
  complaintsEmbedded: number;
  pending: number;
  failed: number;
}> => {
  const [doubts, complaints, jobs] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint; embedded: bigint }>>`
      SELECT count(*) AS total,
             count("embedding") AS embedded
        FROM "Doubt"
    `,
    prisma.$queryRaw<Array<{ total: bigint; embedded: bigint }>>`
      SELECT count(*) AS total,
             count("embedding") AS embedded
        FROM "Complaint"
    `,
    prisma.$queryRaw<Array<{ status: string; n: bigint }>>`
      SELECT "status", count(*) AS n FROM "EmbeddingJob" GROUP BY "status"
    `,
  ]);

  const byStatus = new Map(jobs.map((row) => [row.status, Number(row.n)]));

  return {
    totalDoubts: Number(doubts[0]?.total ?? 0),
    embedded: Number(doubts[0]?.embedded ?? 0),
    totalComplaints: Number(complaints[0]?.total ?? 0),
    complaintsEmbedded: Number(complaints[0]?.embedded ?? 0),
    pending: byStatus.get("PENDING") ?? 0,
    failed: byStatus.get("FAILED") ?? 0,
  };
};

export { Prisma };
