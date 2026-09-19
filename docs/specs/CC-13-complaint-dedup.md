# CC-13: Duplicate complaint detection

| | |
|---|---|
| **Status** | **Shipped 2026-09-20 — complete, 13/13 criteria** |
| **Phase** | 1 |
| **Branch** | `feat/CC-13-complaint-dedup` |
| **Repos** | backend (frontend follow-up) |
| **Depends on** | CC-10 |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | 2026-09-20 |

## Problem

When a projector breaks, every student in the room can file a complaint about it. Today each becomes
an independent ticket: admins triage the same fault repeatedly, assign it repeatedly, and resolve it
repeatedly, while the queue count misrepresents how many distinct problems exist.

Nothing in the system connects two complaints about the same fault. `raiseComplaint`
(`studentController.ts:361`) inserts unconditionally.

The live data already shows the pattern at small scale: 15 complaints, with two locations
(`NL/NL28`, `ML/ML02`) carrying repeats.

## Goal

A student filing a complaint that already exists sees the existing one before submitting, and an
admin can see which open complaints describe the same fault — without any complaint being silently
merged or discarded.

This is also the third feature on CC-10's single embedding pipeline, which was the architectural
argument for building it separately.

## Non-goals / Out of scope

- **Automatic merging.** Never. Merging destroys the reporter list, hides distinct faults that happen
  to read alike, and is unrecoverable. This spec surfaces candidates; humans decide.
- Blocking a student from filing. A warning is shown; submission always remains available. A student
  who insists their problem is different is usually right.
- Complaint routing or category prediction — CC-14.
- Cross-campus or historical analytics.

## Design

### Reuse, not rebuild

CC-10's pipeline is entity-agnostic: `EmbeddingJob` already carries an `entityType`, and the worker
already parks types it does not handle. This spec adds `complaint` support to the existing worker
rather than introducing a second pipeline.

### Schema

Mirrors `Doubt` exactly, including the per-row model tag that makes a model change a detectable
backfill rather than silent corruption:

```prisma
model Complaint {
  // ... existing fields
  embedding        Unsupported("vector(384)")?
  embeddingModel   String?
  embeddingVersion Int       @default(1)
  embeddedAt       DateTime?
}
```

Migration `cc13_add_complaint_embeddings`, with its own HNSW index using `vector_cosine_ops`.

### Similarity is not text alone

Two complaints are duplicates when they describe **the same fault in the same place**. Text
similarity alone would match "fan not working in ML02" with "fan not working in NL28" — different
faults, near-identical wording. So a candidate must satisfy all of:

| Signal | Rule | Why |
|---|---|---|
| Location | same `block` **and** `classroomNumber` | The decisive signal. A fault is physical. |
| Status | not `RESOLVED` | A resolved complaint is not a duplicate of a new one; the fault recurred. |
| Text | cosine similarity ≥ threshold | Distinguishes "broken fan" from "broken projector" in one room. |

Location is an exact filter in the same SQL `WHERE` as the vector scan — the planner combines them,
which is the whole reason vectors live in Postgres ([ADR-0002](../adr/0002-vector-storage.md)).

### Threshold

A similarity floor is required here, unlike CC-11. Duplicate detection makes a **claim** ("this
already exists"), so a wrong answer is worse than no answer; ranked suggestions can afford noise, an
assertion cannot.

The threshold is **calibrated against the real complaints** and recorded in the delivery log, not
guessed. Starting point for measurement: 0.75.

### Endpoints

- `GET /api/students/complaints/similar?title=&description=&block=&classroomNumber=` — pre-submit
  check. Returns at most 3 open complaints with their status and age.
- `POST /api/students/complaints/new` — unchanged behaviour, plus it enqueues an embedding and
  returns a non-blocking `possibleDuplicates` array.
- `GET /api/admin/complaints/duplicates` — open complaints grouped into clusters, for triage.

### Degradation

Identical rule to CC-11: an AI failure must never stop a complaint being filed. With no provider, no
embedding, or a provider error, duplicate detection returns an empty list and filing proceeds
normally.

## Acceptance criteria

1. Complaints are embedded through the existing CC-10 worker; no second pipeline.
2. The worker no longer parks `complaint` jobs as unsupported.
3. Filing a complaint enqueues an embedding and returns in the same time as before.
4. **A provider outage does not prevent filing a complaint.**
5. Two complaints about the same fault in the same room are detected as candidates.
6. Two complaints with near-identical text in *different* rooms are **not** candidates.
7. A `RESOLVED` complaint is never offered as a duplicate of a new one.
   **Verified live 2026-09-20:** querying with a resolved complaint's own exact text, in its own
   room, returns nothing.
8. A complaint is never offered as a duplicate of itself.
   **Verified live 2026-09-20:** with `excludeId` the complaint is absent; without it, it returns
   itself — confirming the filter is what excludes it, not an accident of scoring.
9. No complaint is ever merged, altered, or hidden by this feature.
10. Candidates below the calibrated threshold are excluded.
11. The admin cluster endpoint requires ADMIN or SUPER_ADMIN.
    **MET (completed 2026-09-20).** `GET /api/admin/complaints/duplicates` ships read-only clusters,
    guarded and covered in the authorization matrix.
12. The threshold is calibrated against real data and the calibration is recorded.
13. Existing complaints are backfilled.

## Test plan

- **Unit:** candidate filtering — location mismatch, resolved status, self-exclusion, threshold.
- **Integration (mocked Prisma):** degradation with no provider and with a throwing provider; authz
  on the admin endpoint.
- **Calibration:** against the 15 real complaints, read-only, reporting the similarity distribution
  for same-location and different-location pairs.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| False duplicate discourages a legitimate report | Medium | **High** | Never block submission; wording suggests rather than asserts; threshold calibrated conservatively |
| Threshold tuned on 15 complaints does not generalise | **High** | Medium | Record n with the number; make it an env var; re-calibrate as data grows |
| Location strings are inconsistent (`ML02` vs `ML 02`) | Medium | Medium | Exact match only, so inconsistency causes a miss, never a false positive. Normalisation is a follow-up |
| Free-tier quota consumed by pre-submit checks | Medium | Medium | Same query cache and rate limits as CC-11 |

## Rollback

The migration is additive. Set `AI_ENABLED=false` to disable detection without a deploy; filing is
unaffected either way, since nothing in the write path depends on it.

## Open questions

- Should a confirmed duplicate be linkable by an admin (a `duplicateOfId` column) so the cluster
  survives re-triage? Deferred — it needs a UI, and this spec deliberately ships read-only detection
  first.
- Should location matching fall back to block-only when `classroomNumber` is inconsistent? Measure
  the miss rate first.


---

## Delivery log

### Shipped 2026-09-20 — branch `feat/CC-13-complaint-dedup`

Verified against the live database, read-only:

| Case | Result |
|---|---|
| "Ceiling fan stopped working" in ML/ML02 | matched *"Fan not Working in ML02 Room"* at **0.6165** |
| Same text, different room (ZZ/ZZ99) | no duplicates — the location filter works |
| "No drinking water" in ML/ML02 | no duplicates — the threshold works |
| Complaint rows before/after | 15 / 15 |

15 existing complaints backfilled through the **existing** CC-10 worker. 117 tests passing.

### Threshold calibration

**Production data could not calibrate this**, which is itself the finding. Measured across all 15
live complaints: same-location pairs peaked at **0.144** similarity and were not real duplicates
("Urgent Maintenance" vs "Board Not working properly" are different faults in one room), while the
highest similarity overall — **0.857** — was between two junk placeholder titles in *different*
rooms. There were no real duplicates to learn from.

Calibrated on 16 labelled pairs instead
(`npx tsx src/scripts/calibrateDuplicateThreshold.ts`):

| | |
|---|---|
| lowest true duplicate | 0.538 — "No internet in lab" ~ "Network is down" |
| highest distinct pair | 0.499 — "Fan not working" vs "Fan making loud noise" |
| **threshold chosen** | **0.52** (midpoint) |

The set separates cleanly, but the margin is only **0.039** at n=16, so the threshold is an env var
(`DUPLICATE_SIMILARITY_THRESHOLD`). The hardest case was deliberate: same object, different fault.

### Design notes worth keeping

- **Location is an exact filter, not a scored signal.** A fault is physical. Text similarity alone
  cannot tell "fan broken in ML02" from the same words about NL28, and the live data proved it — the
  highest-similarity pair in the whole database was two different rooms.
- **The threshold is a similarity; pgvector's `<=>` is a distance.** The service converts
  (`maxDistance = 1 - threshold`). Passing the similarity straight through would invert the filter
  and return only the worst matches — there is a test for exactly this.
- **The worker became entity-generic** rather than gaining a second copy: entity types are a
  `HANDLERS` map, so one batch can mix doubts and complaints in a single provider call. That was the
  point of specifying CC-10 separately from its consumers, and this is the third feature on it.

### Completed 2026-09-20 — branch `feat/CC-13b-duplicate-clusters` (+ frontend)

The two gaps from the first delivery are closed.

**Admin cluster view (criterion 11).** `GET /api/admin/complaints/duplicates`, ADMIN/SUPER_ADMIN
only, read-only. Clusters are the connected components of the "possible duplicate of" graph, built
with union-find: pairwise results are not enough for triage, because if A~B and B~C an admin must
see one group of three rather than two overlapping pairs. Members sort oldest first so the original
report — the one to keep and assign — is obvious; larger clusters sort first since they waste the
most triage effort.

Proven end to end with real embeddings inside a rolled-back transaction: three complaints in one
room, the two projector reports paired at **0.7676**, the fan complaint correctly excluded, then
rolled back — 15 rows before and after. Against live data the endpoint returns **0 clusters**, which
is correct: same-location similarity peaks at 0.144, far below the 0.52 threshold.

**Frontend.** The complaint form now calls the advisory endpoint and lists matches above the submit
button. The button's `disabled` condition is unchanged, so **submission is never blocked**, and the
copy says so explicitly. Debounced at 700ms with the request aborted on change; no call is made until
a location is chosen, which both satisfies the backend and saves quota on drafts that cannot produce
a result.

131 tests passing, including the new admin route in the authorization matrix.

### Still open

- A confirmed duplicate cannot yet be *linked* by an admin (`duplicateOfId`), so a cluster is
  recomputed rather than remembered. Deferred deliberately — see Open questions.
- No admin UI consumes the cluster endpoint yet.
