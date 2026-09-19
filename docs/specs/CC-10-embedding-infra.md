# CC-10: Embedding infrastructure

| | |
|---|---|
| **Status** | Shipped 2026-09-19 |
| **Phase** | 1 |
| **Branch** | `feat/CC-10-embedding-infra` |
| **Repos** | backend |
| **Depends on** | CC-01, CC-04 |
| **Blocks** | CC-11, CC-12, CC-13, CC-50 |
| **Estimate** | 4 days |
| **Shipped** | 2026-09-19 |

## Problem

Three roadmap features need to compare text by meaning rather than by characters: semantic doubt
search (CC-11), duplicate complaint clustering (CC-13), and image-doubt matching (CC-50). None of
them can be built until text can be turned into a vector, stored, and searched.

Today there is no vector storage, no embedding provider integration, and no way to run either.

This spec builds **only the pipeline**. It ships no user-visible feature. That is deliberate: three
features depend on this, and specifying it once prevents three inconsistent half-implementations.

## Goal

Any text in the system can be converted into a 384-dimension vector, stored alongside its row in
Postgres, and queried by cosine similarity — reliably, asynchronously, and without an AI provider
outage ever preventing a student from posting a doubt.

## Non-goals / Out of scope

- **Any user-facing search.** CC-11 owns the search endpoint, the fusion, and the UI.
- Complaint embeddings — the pipeline is generic, but CC-13 wires up complaints.
- Answer embeddings — CC-12.
- Re-ranking, query expansion, chunking. Doubt titles and descriptions are short; chunking is
  unnecessary and would complicate the retrieval story for no measurable gain.
- Generation and vision providers — this spec covers embeddings only.

## Design

### 1. Provider layer

Per [ADR-0001](../adr/0001-ai-provider-strategy.md), all provider access is behind an interface.
Nothing outside `src/services/ai/` imports an HTTP client for an AI provider.

```ts
// src/services/ai/types.ts
export interface EmbeddingProvider {
  readonly model: string;       // e.g. "sentence-transformers/all-MiniLM-L6-v2"
  readonly dimensions: number;  // 384
  embed(texts: string[]): Promise<number[][]>;
}
```

`src/services/ai/embeddings/huggingface.ts` implements this against the HuggingFace Inference API
(feature-extraction).

> **Verified live 2026-09-19.** Endpoint, auth, response shape and batching confirmed against the
> real API with the project token:
>
> ```
> POST https://router.huggingface.co/hf-inference/models/
>      sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction
> Authorization: Bearer $HF_API_TOKEN
> Body:     { "inputs": ["text one", "text two"] }
> Response: number[][]  — one 384-float vector per input, already pooled
> ```
>
> - **The legacy `api-inference.huggingface.co` host is dead** (DNS failure). HuggingFace has moved
>   to `router.huggingface.co`. Do not use the old host.
> - **Token permissions matter.** A plain *Read* token returns
>   `403 — This authentication method does not have sufficient permissions to call Inference
>   Providers`. The token needs the **global** "Make calls to Inference Providers" permission; repo
>   read scopes alone are not enough. Note that `whoami-v2` may still report `global: []` even after
>   the permission is granted and calls succeed — trust a real call, not the metadata.
> - **Measured throughput** (single region, warm):
>
>   | Batch size | Total | Per item |
>   |---|---|---|
>   | 1 | 572ms | 572ms |
>   | 20 | 712ms | 36ms |
>   | 50 | 338ms | 7ms |
>
>   Batching is worth ~80x per item. `EMBEDDING_BATCH_SIZE` should default to **50**, not 20.
> - **No rate-limit headers are returned**, so remaining quota cannot be read from a response. 429
>   must be handled reactively via backoff.
> - **Semantic quality sanity check** (cosine, vs "Explain binary search"):
>
>   | Text | Score |
>   |---|---|
>   | How does binary search work? | **0.9467** |
>   | binary search algorithm explanation please | 0.9210 |
>   | What is the time complexity of quicksort? | 0.2460 |
>   | How do I fix a broken projector in the classroom? | -0.0135 |
>
>   The project's motivating example scores 0.95 where the current ILIKE search matches nothing.
>   Related-but-distinct topics separate cleanly, which is what makes a similarity threshold viable.

Requirements:

- Batch input — one HTTP call for many texts. On a free tier this is a correctness requirement, not
  an optimisation: per-item calls will hit the request-rate cap almost immediately.
- Retry on `503` with exponential backoff. HF free-tier models sleep; the first call to a cold model
  can take 20+ seconds or return "model is currently loading". This is normal and must be handled,
  not treated as an error.
- Retry on `429` (rate limited), honouring `Retry-After` when present. On a free tier this is an
  expected operating condition — the job stays `PENDING` and is picked up by the next drain, so
  hitting a quota delays embeddings rather than losing them.
- **Never re-embed unchanged text.** Skip any row whose embedding exists and whose source text
  hasn't changed. Quota spent re-computing an identical vector is quota unavailable to real work.
- Hard timeout (30s) so a hanging provider cannot hold a lambda open.
- Assert the returned vector length equals `dimensions` and throw if not — a silent shape change is
  how an index gets corrupted.

**There is no fallback provider for embeddings.** ADR-0001 explains why: vectors from different
models occupy different spaces, so substituting Mistral on failure would silently poison the index
with no error. Failure is handled by the queue below.

### 2. Schema

```prisma
model Doubt {
  // ... existing fields
  embedding        Unsupported("vector(384)")?
  embeddingModel   String?
  embeddingVersion Int       @default(1)
  embeddedAt       DateTime?
}

model EmbeddingJob {
  id          String   @id @default(uuid())
  entityType  String   // "doubt" | "complaint" | "answer"
  entityId    String
  status      String   @default("PENDING") // PENDING | PROCESSING | DONE | FAILED
  attempts    Int      @default(0)
  lastError   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([entityType, entityId])
  @@index([status, createdAt])
}
```

Migration `cc10_add_embeddings`, created with `--create-only` and hand-edited, because Prisma cannot
express the extension or the index:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Doubt" ADD COLUMN "embedding" vector(384);
ALTER TABLE "Doubt" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "Doubt" ADD COLUMN "embeddingVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Doubt" ADD COLUMN "embeddedAt" TIMESTAMP(3);

CREATE INDEX "doubt_embedding_hnsw" ON "Doubt"
  USING hnsw ("embedding" vector_cosine_ops);
```

`embeddingModel` is stored per row so a future model change is a detectable backfill rather than
silent corruption. The repository **refuses to write** a vector whose model tag differs from the
configured canonical model.

> **Verified 2026-09-19 against the live database — no dashboard access required.**
> `pgvector` **0.8.0** is available (not yet installed) on PostgreSQL **17.6**. The `postgres` role
> used by `DATABASE_URL` can run `CREATE EXTENSION vector` itself despite not being a superuser —
> confirmed by a dry run inside a rolled-back transaction, which also proved the `vector(384)` type
> and the `<=>` cosine operator work. The migration can therefore enable the extension unaided.
>
> `pg_trgm` 1.6 is also available and not installed — relevant to CC-11's keyword retriever.

### 3. Repository layer

Prisma 7 cannot type `vector`, so `Unsupported(...)` makes the column invisible to the typed client
and every read/write goes through raw SQL. Confine that to one module —
`src/repositories/embeddingRepository.ts` — so no controller ever contains SQL:

```ts
writeEmbedding(entityType, entityId, vector, model): Promise<void>
findSimilarDoubts(vector, opts: {
  limit: number;
  subject?: string;
  semester?: number;
  excludeId?: string;
}): Promise<Array<{ id: string; distance: number }>>
```

Similarity uses the cosine distance operator, with filters in the same `WHERE` clause so the planner
can combine them:

```sql
SELECT id, embedding <=> $1::vector AS distance
FROM "Doubt"
WHERE embedding IS NOT NULL
  AND ($2::text IS NULL OR subject = $2)
  AND ($3::int  IS NULL OR semester = $3)
  AND id <> $4
ORDER BY distance
LIMIT $5;
```

Vectors are passed as parameters, never string-interpolated.

> **Never `SELECT *` on `Doubt` again.** The column is ~1.5KB per row; a default Prisma select would
> start pulling embeddings into every doubt list response. Existing controllers mostly use explicit
> `select` blocks — audit them as part of this branch.

### 4. Job queue and worker

Embedding is **asynchronous and non-blocking**. Doubt creation enqueues an `EmbeddingJob` in the same
transaction as the doubt insert, then returns. It never calls the provider inline.

This is the single most important design decision in the spec: HF cold starts take 20+ seconds, and
Vercel functions have an execution limit. Embedding inline would make posting a doubt slow, flaky,
and dependent on a third party.

A worker drains the queue:

- `POST /api/internal/embeddings/drain` — takes up to `EMBEDDING_BATCH_SIZE` (default 50, see the
  measured throughput above) pending
  jobs, embeds them in one batched provider call, writes vectors, marks jobs `DONE`.
- Triggered by **Vercel cron every 5 minutes**, and opportunistically after doubt creation
  (fire-and-forget, failure ignored) so the common case is fast.
- Protected by a shared-secret header (`INTERNAL_API_SECRET`), never by user auth.
- `attempts` increments on failure with backoff; at 5 attempts the job is marked `FAILED` and left
  for inspection. Failed jobs are visible to admins, not silently dropped.
- Claims rows with `FOR UPDATE SKIP LOCKED` so two concurrent cron invocations cannot double-process.

### 5. Backfill

A one-off script, `src/scripts/backfillEmbeddings.ts`, enqueues jobs for every existing doubt with a
null embedding. Idempotent (the `@@unique([entityType, entityId])` makes re-runs safe), resumable,
and rate-limit aware. Run once after the migration.

### 6. Kill switch

`AI_ENABLED=false` makes the worker a no-op and stops enqueueing. Nothing else in the application
changes behaviour. Consumers must treat "no embedding" as a normal state, not an error — this is what
lets CC-11 degrade to keyword search cleanly.

## Acceptance criteria

1. `CREATE EXTENSION vector` and the HNSW index are applied by a checked-in migration.
2. Creating a doubt returns in the same time as before (within noise) and creates exactly one
   `PENDING` `EmbeddingJob`.
3. **A total AI provider outage does not prevent posting a doubt.** With an invalid `HF_API_TOKEN`,
   doubt creation still returns `201`.
4. Draining the queue populates `embedding`, `embeddingModel`, and `embeddedAt`; jobs become `DONE`.
5. `findSimilarDoubts` returns rows ordered by ascending cosine distance, honours `subject`,
   `semester`, and `excludeId`, and never returns rows with a null embedding.
6. Semantic sanity: with "Explain binary search" embedded, querying "How does binary search work?"
   ranks it above a doubt about an unrelated topic.
7. A provider returning a wrong-length vector causes the job to fail and **writes nothing**.
8. Writing a vector whose model tag differs from `HF_EMBEDDING_MODEL` throws.
9. HF `503`/"model loading" and `429` are retried with backoff and eventually succeed, without
   failing the job on the first attempt. A `429` leaves the job `PENDING`, not `FAILED`.
16. Re-running the drain over already-embedded, unchanged rows makes **zero** provider calls.
10. A job failing 5 times is marked `FAILED` with `lastError` populated and is not retried further.
11. Two concurrent drains do not process the same job twice.
12. The drain endpoint returns `401` without the internal secret.
13. `AI_ENABLED=false` stops enqueueing and makes the drain a no-op.
14. The backfill script is safe to run twice and creates no duplicate jobs.
15. No response payload anywhere in the API contains an embedding vector.

## Test plan

- **Unit:** provider retry/backoff against a mocked HF endpoint (503 then 200); dimension assertion;
  model-tag mismatch rejection; batching.
- **Integration:** doubt creation enqueues a job; drain populates vectors; drain with a failing
  provider increments `attempts` without writing; drain auth; `SKIP LOCKED` concurrency with two
  parallel calls.
- **Integration:** `findSimilarDoubts` filter correctness on a seeded fixture set.
- **Manual:** seed ~20 real doubts, run the backfill, and eyeball the top-5 neighbours for five
  queries. This is the honest check that embeddings are wired correctly — a dimension or
  normalisation bug produces plausible-looking-but-wrong rankings that unit tests will not catch.
- **Manual:** confirm doubt list endpoint response sizes are unchanged after the migration.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| HF free tier cold starts / rate limits | **High** | Medium | Async queue is the entire mitigation; backoff on 503/429; batching; never re-embed unchanged text |
| Backfill exhausts the daily free quota before a demo | Medium | **High** | Run the backfill days ahead, never the night before; drain is resumable, so a quota stop is safe |
| Prisma `Unsupported` friction spreads raw SQL through the codebase | High | Medium | All raw SQL confined to `embeddingRepository.ts`; enforced in review |
| `SELECT *` starts returning vectors, bloating responses | Medium | Medium | Explicit `select` audit in this branch; acceptance criterion 15 |
| Supabase pooler rejects prepared statements in transaction mode | Medium | Medium | Test `$queryRaw` against the pooled URL early, on day 1, not at the end |
| pgvector unavailable on the Supabase plan | Low | **Blocking** | Verify before starting. Whole phase depends on it |
| Provider silently changes model output | Low | High | Dimension assertion + per-row model tag |
| Backfill exhausts the free-tier quota | Medium | Low | Rate-limit aware, resumable, run overnight |

## Rollback

The migration is additive — columns and a new table, no data destroyed. Set `AI_ENABLED=false` to
disable the pipeline without a code change. To fully revert, drop the three `Doubt` columns, the
index, and `EmbeddingJob`; nothing else reads them at this stage, since CC-10 ships no user-facing
feature. **Dropping the columns discards computed embeddings** — cheap to regenerate via backfill,
but take a database snapshot first out of habit.

## Open questions

> **Resolved:** pgvector availability and permissions (see *Schema*); HF endpoint, auth, response
> shape, batching and embedding quality (see *Provider layer*).

- Should the embedded text be `title` alone or `title + "\n" + description`? Recommend both
  concatenated, truncated to the model's 256-token window — but CC-11's eval harness can measure it,
  so treat this as the first experiment rather than a guess. Record the result in CC-11.
- **Free-tier request/day limits are still unknown** — HuggingFace returns no rate-limit headers, so
  they cannot be read from a response. Throughput and batch size are now measured (above); the
  remaining unknown is the daily cap, which will only reveal itself as a 429 under load. The retry
  queue is designed for exactly that, so this does not block implementation.


---

## Delivery log

### Shipped 2026-09-19 — branch `feat/CC-10-embedding-infra`

Verified against the live database and the live provider:

| Check | Result |
|---|---|
| Migration rehearsed in a rolled-back transaction before applying | SQL, HNSW index and `<=>` operator all valid; database unchanged |
| Migration applied | pgvector 0.8.0, 4 columns on `Doubt`, HNSW index, `EmbeddingJob` |
| Backfill of existing doubts | 7/7 embedded, 0 failed, correct model tag |
| Backfill re-run | "Nothing to do" — idempotent |
| Similarity search through the repository | sensible neighbours on real rows |
| Drain endpoint without secret | `401` |
| Drain via `POST` + `x-internal-secret` | works |
| Drain via `GET` + `Authorization: Bearer` (Vercel Cron form) | works |
| Test suite | 77 passing, 3.3s |

### Found during implementation

1. **Vercel Cron issues `GET`, not `POST`**, and authenticates with
   `Authorization: Bearer $CRON_SECRET`. The drain endpoint answers both verbs and accepts either
   `x-internal-secret` or the bearer form.
2. **Vercel's Hobby plan permits daily cron only.** The schedule is set to `0 2 * * *` accordingly,
   which means the opportunistic drain fired after a doubt is posted carries most of the load. Finer
   scheduling needs a Pro plan. If embeddings ever lag noticeably, this is why.
3. **The backfill script hung for minutes after finishing.** `config/database.ts` holds a pg `Pool`
   with keep-alive enabled, and `prisma.$disconnect()` does not close it, so the event loop stayed
   alive. Fixed with an explicit `process.exit` once the work completes. Any future CLI script in
   this repo needs the same treatment.
4. **Pre-existing migration drift, unrelated to this work:** the database records a migration
   `20260514120000_remove_user_university` that does not exist in the repository, and
   `User.university` still exists in the schema anyway. A teammate applied a migration and never
   committed the file. Harmless today, but a fresh clone will not reproduce the production schema.
   **Worth resolving as a team** — see CC-00's observations.

### Not wired up yet

- Complaint and answer embeddings. The pipeline is generic and the worker parks unsupported entity
  types, but only `doubt` is enqueued. Complaints are CC-13, answers CC-12.
- No user-facing search endpoint. That is CC-11, by design.
