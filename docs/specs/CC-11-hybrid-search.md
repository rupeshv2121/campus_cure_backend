# CC-11: Hybrid semantic doubt search + evaluation harness

| | |
|---|---|
| **Status** | Shipped 2026-09-19 |
| **Phase** | 1 |
| **Branch** | `feat/CC-11-hybrid-search` |
| **Repos** | backend (frontend follow-up) |
| **Depends on** | CC-10 |
| **Blocks** | CC-12, CC-15 |
| **Estimate** | 5 days |
| **Shipped** | 2026-09-19 |

## Problem

`GET /api/students/doubts/suggestions` finds duplicate doubts by keyword overlap
(`studentController.ts:566-680`): substring matches on a normalised title and description, weighted
6/3/3/1, filtered to `score > 0`.

It cannot match meaning. Verified against the live system: *"Explain binary search"* and *"How does
binary search work?"* share no scoreable substring, so the existing search returns **nothing**, while
their embeddings score **0.9467**.

CC-10 built the embedding pipeline but deliberately shipped no user-facing search. This is that
feature — and, more importantly, the measurement that justifies it.

## Goal

Duplicate-doubt suggestions that match on meaning as well as wording, with the improvement
**measured** against the existing keyword baseline rather than asserted.

## Non-goals / Out of scope

- Replacing the keyword search. It stays in the codebase as the baseline — deleting it would destroy
  the comparison this spec exists to produce.
- Answer or complaint search (CC-12, CC-13).
- Re-ranking with a cross-encoder, query expansion, spell correction.
- Frontend changes. The endpoint keeps its response shape so the existing UI works unchanged; any
  redesign is a follow-up.
- Personalised or learning-to-rank scoring.

## Design

### Three retrievers, one query engine

All three are native Postgres, which is the whole argument for [ADR-0002](../adr/0002-vector-storage.md):

| Retriever | Mechanism | Strength |
|---|---|---|
| `keyword` | the existing weighted substring scorer, extracted unchanged | exact identifiers, error codes |
| `fts` | `to_tsvector('english', …)` + `ts_rank`, GIN indexed | stemming, word-order independence |
| `vector` | pgvector `<=>` cosine over CC-10 embeddings | paraphrase, synonymy |

Each is a pure function returning `Array<{ id, rank }>`, so they can be evaluated independently.

### Fusion: Reciprocal Rank Fusion

```
score(d) = Σ  1 / (k + rank_i(d))       k = 60
```

RRF over score-normalisation because the three retrievers produce incomparable scales — a cosine
distance, a `ts_rank` float and an ad-hoc 6/3/3/1 integer cannot be averaged meaningfully. RRF uses
only ordinal position, so no normalisation is needed and one retriever returning wild magnitudes
cannot dominate.

`k = 60` is the standard default; it is a tunable the harness can sweep.

### Degradation

Vector retrieval needs an HTTP call to embed the query (~300–600ms measured). It must never be
load-bearing:

- `AI_ENABLED=false`, no provider, provider error, or timeout → fall back to `keyword` + `fts`.
- Any retriever throwing is logged and dropped from the fusion, not propagated.
- The endpoint's response shape is unchanged, so the existing frontend keeps working either way.

**Latency note:** this endpoint fires as a student types. The added embedding call makes debouncing a
frontend requirement, and per-user rate limiting (CC-01) already applies. A short-lived in-process
cache keyed on the normalised query absorbs repeated keystrokes.

### Schema

A GIN index for full-text search. No new column — an expression index keeps the text in one place:

```sql
CREATE INDEX doubt_fts_idx ON "Doubt"
  USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
```

Migration `cc11_add_fts_index`. Additive and reversible.

### The evaluation harness

**This is the deliverable that turns a feature into a result**, and the reason the keyword path stays.

- A fixtures corpus of realistic doubts plus labelled `query → relevant doubt id(s)` pairs, checked
  into the repo so results are reproducible.
- `src/scripts/evalRetrieval.ts` reports **Recall@5** and **MRR** for all four configurations:
  `keyword`, `fts`, `vector`, `hybrid`.

**It writes nothing to the database.** The corpus is fed to Postgres as a `VALUES` CTE, so `ts_rank`
is computed by the real engine against the real configuration without inserting a single row.
Vector similarity is computed in-process from real HuggingFace embeddings. This keeps the harness
honest — it measures the actual retrievers, not reimplementations — while keeping production data
clean, which matters after the CC-01c incident.

Production data cannot serve as the evaluation set: there are 7 doubts, most of them titled things
like "New Title 2".

### First experiment

CC-10 left a live question. Querying the exact title *"Algebra Maths"* scored only **0.5762**,
because stored vectors are `title + description` while the query is title-only. The harness must
compare **title-only**, **description-only** and **concatenated** embedding text, and the winner
becomes `buildEmbeddingText`. Changing it requires a re-backfill, so this is measured before CC-12
builds on it.

## Acceptance criteria

1. `GET /api/students/doubts/suggestions` returns results fused from all three retrievers.
2. Querying *"How does binary search work?"* retrieves a doubt titled *"Explain binary search"* —
   the case the current implementation misses entirely.
3. Response shape is unchanged; the existing frontend needs no edit.
4. With `AI_ENABLED=false`, the endpoint still returns keyword + FTS results and no error.
5. With a deliberately broken HF token, the endpoint still returns results.
6. A retriever that throws is dropped from fusion, logged, and does not fail the request.
7. `subject` and `semester` filters apply to every retriever.
8. The doubt being edited is excluded from its own suggestions.
9. RRF is unit-tested: known rank lists produce the expected fused order.
10. The eval harness reports Recall@5 and MRR for all four configurations.
11. The harness writes nothing to the database — verified by row counts before and after.
12. ~~Hybrid scores at least as well as the best single retriever on Recall@5.~~
    **FAILED — see Results.** Vector alone scored 100%; the best hybrid scored 96.2%. The criterion
    was wrong to assume hybrid must win; the measurement is the deliverable, not a target to hit.
13. The keyword baseline remains callable and unmodified in behaviour.
14. Repeated identical queries within the cache window make one embedding call, not several.

## Test plan

- **Unit:** RRF fusion; keyword scorer parity with the pre-extraction implementation; cache behaviour.
- **Integration (mocked Prisma):** degradation paths — AI disabled, provider throwing, one retriever
  failing; filter propagation; self-exclusion.
- **Harness:** the measurement itself, reported in the delivery log.
- **Negative:** break each retriever in turn and confirm the endpoint still answers.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Embedding call makes the endpoint slow as a user types | **High** | Medium | Query cache; frontend debounce; degradation never blocks |
| Free-tier quota consumed by search traffic | Medium | Medium | Cache; CC-01 per-user rate limits; short-circuit queries under 3 chars |
| Hybrid scores *worse* than keyword on this corpus | Medium | Low | That is a publishable result, not a failure — report it honestly and keep the better default |
| Labelled set too small to be meaningful | **High** | Medium | State n explicitly with every metric; never present a 20-pair result as definitive |
| `english` text-search config mismatched to mixed-language content | Medium | Low | Note it; revisit alongside CC-71 (i18n) |

## Rollback

The migration is an index — drop it. The endpoint can be reverted to the keyword path by a single
call change, since the baseline scorer remains intact and tested.

## Open questions

- RRF `k`: 60 is the literature default. The harness can sweep it; only override with evidence.
- Should `fts` use `plainto_tsquery` or `websearch_to_tsquery`? The latter handles quoted phrases and
  negation. Start with `plainto_tsquery`, measure.
- Is a similarity floor needed to avoid surfacing unrelated doubts on a query matching nothing? The
  distance distribution from the harness should decide.


---

## Results

Measured on the checked-in corpus: **24 documents, 26 labelled queries**. Reproduce with
`npx tsx src/scripts/evalRetrieval.ts`.

| config | Recall@5 | MRR |
|---|---|---|
| keyword (existing baseline) | 84.6% | 0.800 |
| fts — `plainto_tsquery`, AND | 38.5% | 0.385 |
| **fts — OR semantics** | **96.2%** | **0.923** |
| **vector** | **100.0%** | **1.000** |
| hybrid — equal weights | 96.2% | 0.909 |
| hybrid — weighted (shipped) | 96.2% | 0.928 |

By query type (Recall@5):

| kind | n | keyword | ftsOr | vector | hybridW |
|---|---|---|---|---|---|
| exact | 8 | 100% | 100% | 100% | 100% |
| paraphrase | 9 | 100% | 100% | 100% | 100% |
| morphology | 3 | 100% | 100% | 100% | 100% |
| **hard** | 6 | **33.3%** | 83.3% | **100%** | 83.3% |

The keyword baseline collapses to 33.3% exactly where the feature is supposed to help: queries with
little literal overlap. That gap is the case for the whole spec.

### Two findings that changed the implementation

**1. Full-text was crippled by AND semantics, not by being a weak retriever.**
`plainto_tsquery` requires *every* term to match, so "why is quicksort sometimes slow" matched
nothing. Switching to OR took the same retriever from **38.5% → 96.2%** Recall@5. This endpoint
suggests possible duplicates, where recall matters far more than precision — RRF handles ordering.

**2. Equal-weight RRF made results worse than a single retriever.** Naive fusion let a 38.5%
retriever drag down a 100% one, scoring 92.3%. Weighting by measured quality
(`vector 3, keyword 2, fts 1`) recovered it to 96.2% with the best hybrid MRR. Weights come from the
harness; re-measure before changing them.

### Why hybrid ships as the default even though vector scored higher

An honest statement of a judgement call that the measurement does **not** fully support:

- The gap is **one query in 26** (100% vs 96.2%) — inside the noise band at this sample size.
- Vector-only means a hard dependency on a free-tier third party with no uptime guarantee. Criteria
  4 and 5 require search to work with AI disabled or the provider broken; vector-only cannot.
- A 24-document corpus is unrealistically easy for embeddings — there is no headroom for lexical
  signals to contribute. With thousands of doubts, rare-term and exact-identifier queries are where
  keyword and FTS earn their place.

If a larger labelled set later shows vector-only still winning, switching is a one-line change to the
`retrievers` option.

### Caveat

**n = 26 is small.** Every number above is directional. The corpus is synthetic — production holds 7
doubts, most titled "New Title 2" — so these measure the retrievers, not this campus's traffic. The
honest next step is labelling real queries once the system has been used.

## Delivery log

### Shipped 2026-09-19 — branch `feat/CC-11-hybrid-search`

| Check | Result |
|---|---|
| FTS migration rehearsed, then applied | `doubt_fts_idx` (gin), valid |
| Live search, real database | all 3 retrievers, `degraded: false` |
| Paraphrase on real data | "how do I understand DP concepts" → "I am confused on Dynamic Programming Concepts" |
| Harness writes nothing | Doubt rows 7 → 7, asserted by the script |
| Test suite | 103 passing, 2.3s |

### Resolves CC-10's open question

Embedding text was measured three ways. **Concatenated wins decisively**, so `buildEmbeddingText` is
correct as written and **no re-backfill is needed**:

| embedding text | vector Recall@5 | MRR |
|---|---|---|
| **title + description** | **100.0%** | **1.000** |
| title only | 96.2% | 0.756 |
| description only | 96.2% | 0.964 |

### Found during implementation

1. **The HNSW index from CC-10 had vanished.** Verified present immediately after that migration,
   absent a few hours later; the migration is recorded as finished, all 7 vectors survived, and a
   later statement from the same file (EmbeddingJob's unique index) exists — so the CREATE INDEX did
   run. Cause not established. Migration `20260919150000_cc11_ensure_hnsw_index` recreates it
   idempotently. **If this recurs, investigate whether the platform reclaims HNSW indexes on the free
   tier** — without it, vector search silently degrades to a sequential scan.
2. **The keyword baseline was nearly corrupted during extraction.** The stop-word list was
   reconstructed rather than copied, producing ~50 invented words in place of the original 29. Caught
   by a parity test, restored verbatim from git, and the evaluation re-run. The baseline must be
   byte-identical or every comparison in this document is meaningless — the parity tests now guard it.

### Not done

- **Frontend.** The response keeps its shape (`suggestions[]`), with `retrievers` and `degraded`
  added, so the existing UI works untouched. Debouncing the search box is now a real requirement:
  every keystroke can cost an embedding call.
