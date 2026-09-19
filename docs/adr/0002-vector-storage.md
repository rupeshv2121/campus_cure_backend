# ADR-0002: Vector storage in Postgres (pgvector)

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-16 |
| **Supersedes** | — |

## Context

CC-11 (semantic doubt search) and CC-13 (complaint deduplication) need approximate nearest-neighbour
search over embedding vectors. The original plan named FAISS, ChromaDB, and Pinecone.

Our data lives in Supabase Postgres. Expected scale is small: a campus generates on the order of
10³–10⁴ doubts, not 10⁸.

## Decision

Store vectors in the **existing Supabase Postgres** using the `pgvector` extension. No separate
vector database.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Doubt" ADD COLUMN embedding vector(384);
CREATE INDEX doubt_embedding_hnsw ON "Doubt"
  USING hnsw (embedding vector_cosine_ops);
```

## Rationale

- **It is already there.** Supabase ships pgvector. Zero new infrastructure, zero new credentials,
  zero new failure modes, no free-tier limits to outgrow.
- **One consistency domain.** A doubt and its vector are written in the same transaction. With an
  external vector DB, every write is a two-phase problem and drift between the row and its vector is
  inevitable — a real and tedious class of bug.
- **Filtering is free.** Search is always scoped by `subject`, `semester`, and moderation status.
  In Postgres that's a `WHERE` clause the planner combines with the vector scan. In FAISS,
  pre-filtering means maintaining a separate index per filter combination, and post-filtering means
  over-fetching and hoping.
- **Hybrid retrieval needs one query engine.** CC-11 fuses vector similarity, full-text search, and
  the existing keyword path. All three are native Postgres. Splitting the vector half into another
  system turns one SQL statement into an application-layer join.
- **HNSW is more than sufficient** at our scale — sub-10ms for tens of thousands of rows.

## Consequences

**Good**

- No new service, no new bill, no new outage source.
- Backups, migrations, and access control are already solved by the existing database.
- Row and vector can never drift apart.

**Bad / to plan for**

- **Prisma 7 has no native `vector` type.** The column must be declared
  `Unsupported("vector(384)")` in `schema.prisma`, which means it is invisible to the typed client:
  all vector reads and writes go through `$queryRaw` / `$executeRaw`. CC-10 wraps this in a small
  repository module so raw SQL doesn't leak into controllers. Expect this friction; it is the main
  cost of the decision.
- The extension and HNSW index need a **hand-written migration** — `prisma migrate dev --create-only`,
  then edit the SQL.
- Vector columns are physically large (384 floats ≈ 1.5KB/row). Never `SELECT *` on `Doubt` once the
  column exists — Prisma's default select would start pulling embeddings into every doubt list
  response. Explicit `select` blocks only, which the existing controllers already mostly use.
- Connection pooling: Supabase's pooler in transaction mode does not support prepared statements the
  way a direct connection does. Vector queries via `$queryRaw` are fine, but if odd errors appear
  under load, the pooler mode is the first thing to check.

## Alternatives considered

| Option | Rejected because |
|---|---|
| **FAISS** | Needs a persistent process and local filesystem. Our backend is a stateless Vercel lambda — the index would rebuild on every cold start. Architecturally impossible here. |
| **ChromaDB** | Same persistence problem, plus a service to host. |
| **Pinecone** | Works, but adds a vendor, a credential, and a two-phase write for a dataset small enough to fit comfortably in a table we already own. |

The common thread: all three solve a scale problem we do not have, at the cost of a consistency
problem we would then have to solve.

### Re-examined 2026-09-19 — hosted free-tier vector databases

The question "should we use a dedicated free vector DB instead?" was raised again. Current free
tiers were checked rather than assumed:

| Service | Free tier | Verdict |
|---|---|---|
| **Supabase pgvector** | Included at no extra charge on the existing 500 MB database | **Chosen** |
| **Qdrant Cloud** | 1 GB RAM / 4 GB disk, 1M vectors, 1 collection, permanent | Capable, but unnecessary |
| **Pinecone** | ~2 GB / ~1M vectors | Capable, but unnecessary |

Capacity is not the deciding factor — all three are far larger than we need. At 384 dimensions a
vector is 1,536 bytes, so 10,000 doubts is roughly 15 MB of raw vectors (~30-45 MB with HNSW index
overhead) against a 500 MB database. We would use about 1% of Qdrant's free tier.

The decision rests on **CC-11**, which is hybrid retrieval: keyword + Postgres full-text + vector,
fused with Reciprocal Rank Fusion, evaluated against the existing keyword baseline. Two of those
three retrievers are already SQL. Moving the third to an external service turns one query into
three round trips plus an application-layer join back to Postgres to hydrate rows — which also
breaks clean filtering and pagination, and makes the evaluation harness substantially harder to
write. The academic contribution of this project is that comparison; the architecture should make it
easy, not hard.

Secondary but real: an external store means the doubt row and its vector are written in two phases,
so drift between them becomes a permanent class of bug we would have to defend against.

**Accepted downside:** vector queries share CPU with application queries on one shared-CPU
instance. At our scale this is not measurable; if it ever becomes so, that is the trigger to revisit.

**Unrelated to this decision:** Supabase free projects pause after 7 days of database inactivity.
This already affects the whole application — it is why `/keep-db-alive` exists in `app.ts` — and
adding an external vector database would not fix it.

## Revisit if

- Doubt volume exceeds ~10⁶ rows, or
- Vector search latency exceeds ~200ms at p95 after index tuning, or
- We need multi-tenant vector isolation beyond what row-level filtering provides.

None of these are plausible for a single campus.
