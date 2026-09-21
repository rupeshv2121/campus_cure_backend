# CC-20: Doubt tags

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration NOT applied; pending review/merge |
| **Phase** | 2 |
| **Branch** | `feat/CC-20-tags` |
| **Repos** | both |
| **Depends on** | none |
| **Blocks** | nothing |
| **Estimate** | 1.5 days |
| **Shipped** | — |

## Problem

**Correction to the roadmap.** `ROADMAP.md` describes `Doubt.labels[]` as "already exists in schema,
unused". That is not accurate, and the difference changes the work. Labels are already written and
already displayed:

| Path | Location |
|---|---|
| Write, on create | `studentController.ts:657`, stored at `:682` |
| Write, on edit | `studentController.ts:1095`, stored at `:1127` |
| Client type | `CampusCure_Frontend/src/types/index.ts:128` |
| Input (comma-separated text) | `DoubtCommunity.tsx:64`, split at `:238` |
| Render | `DoubtCommunity.tsx:456`, `FacultyDoubts.tsx:173`, `FacultyDoubtDetail.tsx:345` |

So the field is live, and there is production data in it. What is missing is everything that makes a
tag useful rather than decorative:

1. **No filter.** `getDoubts` (`studentController.ts:723`) builds its `where` from `status`,
   `subject`, `semester` and `search` only — lines 729–761. The tag chips are rendered as
   non-interactive `<Tag>` elements. A student can see that a doubt is tagged `recursion` and has no
   way to ask for the other doubts tagged `recursion`.
2. **No normalization.** `DoubtCommunity.tsx:238` splits on comma and trims, and nothing else. So
   `Recursion`, `recursion` and `RECURSION` are three different tags, and a typo is a permanent
   orphan.
3. **No vocabulary.** A free-text box with no suggestions guarantees divergence. There is no endpoint
   that can answer "what tags exist?", so no autocomplete is possible.

The result is a field that looks like a taxonomy and behaves like a comment.

## Goal

Tags become a navigation mechanism. One concept is one tag — it matches as one when filtering,
counts as one in the vocabulary, and looks the same everywhere it is rendered, whatever casing each
author happened to type. Students pick from what already exists instead of inventing near-duplicates,
and clicking a tag anywhere filters the doubt list to it.

None of that is achieved by rewriting what anyone wrote.

## Non-goals / Out of scope

- **Tags on complaints or answers.** Doubts only. Complaint categorization is CC-14 and is already
  solved differently.
- **A tag moderation UI** — renaming, merging, deleting, admin-curated vocabularies. If tag sprawl
  becomes a real problem, that is its own spec with its own evidence.
- **Tag pages** (`/tags/recursion` with its own route and description). The filter is a query
  parameter on the existing list.
- **Tag-based notifications or subscriptions.** That is CC-21's neighbourhood, and neither is
  specced for it.
- **Backfilling or auto-suggesting tags with the AI stack.** Tempting, given CC-10 is shipped, and
  out of scope at this size.
- **A separate `Tag` table.** See below — deliberate.

## Design

### No `Tag` table

`labels String[]` stays as it is. A join table buys referential integrity, a rename primitive, and
exact counts; it costs a migration, two new models, and a rewrite of all five call sites above — for
a corpus that currently holds tens of doubts. Postgres indexes array containment natively, which
covers the only query this spec needs.

If a tag moderation UI is ever specced, that is the moment to revisit this. Recorded here so the
decision is not silently re-litigated.

### Derive, do not overwrite

The obvious implementation is to lowercase `labels` in place and index it. **Do not.** That destroys
what the author typed, cannot be undone, and buys nothing that a second column does not buy more
safely. `React` becoming `react` is cosmetically fine; `React` becoming unrecoverable is a one-way
migration on live data in exchange for a query convenience.

So `labels` is left exactly as authored and a derived column carries the normalized form:

```prisma
model Doubt {
  labels           String[]  // unchanged — exactly as the author typed it
  /// CC-20. Derived from `labels` on every write. Never user-supplied, never
  /// rendered: it is the lookup key that filtering, aggregation and canonical
  /// display all match on. `labels` remains the source of truth — if the
  /// two ever disagree, `labels` is right and this is stale.
  labelsNormalized String[]  @default([])

  @@index([labelsNormalized], type: Gin)
}
```

Migration: `npx prisma migrate dev --name cc20_add_doubt_labels_normalized`.

Filtering, counting and autocomplete read `labelsNormalized`. `labels` is the preserved record of
what the author typed. Neither is rendered directly — see the next section.

### One tag, one appearance

`Recursion` and `recursion` are the same tag, so they must also *look* the same. Rendering `labels`
verbatim would leave two cards side by side showing what appears to be two different tags, which
defeats the point of normalizing at all.

They are unified at **render** time, not on write. Every chip displays the canonical casing for its
normalized form, resolved through the vocabulary map:

```
stored labels:  ["Recursion"]   ["recursion"]   ["RECURSION"]
normalized:      recursion       recursion       recursion
rendered:       "Recursion"     "Recursion"     "Recursion"   ← canonical, from the vocabulary
```

This is the third distinct role, and keeping the three separate is what makes the design work:

| | Source | Purpose |
|---|---|---|
| Stored | `labels` | The author's own words. Never overwritten, never rendered. |
| Matched | `labelsNormalized` | Filtering, counting, autocomplete. Never rendered. |
| Rendered | vocabulary `display` | What every user sees. Derived, not stored. |

Because display is derived, changing the canonical casing later is a cache invalidation, not a
migration. And because `labels` is untouched underneath, the original is always recoverable.

### Normalization

One shared function, applied on **write only**, in a new `src/utils/tags.ts`:

```ts
export const MAX_TAGS_PER_DOUBT = 5;
export const MAX_TAG_LENGTH = 30;

/** lowercase, trim, collapse whitespace to "-", strip anything not [a-z0-9-+#.] */
export const normalizeTag = (raw: string): string | null => { /* ... */ };

/**
 * The only function a write path should call. Returns both columns from one
 * pass so they cannot drift: same length, same order, deduped on the normalized
 * form (first casing seen wins), capped at MAX_TAGS_PER_DOUBT.
 * Throws on a tag over MAX_TAG_LENGTH so the caller can answer 400.
 */
export const prepareTags = (
  raw: string[],
): { labels: string[]; labelsNormalized: string[] } => { /* ... */ };
```

`+`, `#` and `.` survive because `c++`, `c#` and `node.js` are all real tags a student will type.

Validation (length, count) still rejects bad input before `labels` is written — the raw column is
kept faithful, not unvalidated. What it is not is *rewritten*.

Applied at `studentController.ts:682` (create) and `:1127` (edit). Both call sites go through
`prepareTags`, or the invariant does not hold — a single paired helper is what makes it hard to
update one column and forget the other.

### Backfill

Because the column is derived, the backfill is **additive and idempotent**: it reads `labels`,
computes `labelsNormalized`, and writes only the new column. Nothing is overwritten, so it can be
re-run at any time — after a change to `normalizeTag`, for instance, which is a normal thing to want
and would otherwise be impossible.

`src/scripts/normalizeDoubtLabels.ts`, following the pattern of the existing `backfillEmbeddings.ts`.
Safe to run before the code deploys, since nothing reads the column yet.

### Filter

`getDoubts` gains one parameter, following the shape of the existing blocks at lines 729–761:

```ts
// ?tag=recursion  (repeatable: ?tag=recursion&tag=dp — AND, not OR)
if (tags.length > 0) {
  where.labelsNormalized = { hasEvery: tags.map(normalizeTag).filter(Boolean) };
}
```

`hasEvery` rather than `hasSome`: a student narrowing a list expects each added tag to show *fewer*
results. `hasSome` is the surprising one.

The incoming query parameter goes through the same `normalizeTag` as the write path, so both sides of
the comparison are canonical and `hasEvery` stays an exact match against a GIN-indexed column. No
raw SQL, no `mode: "insensitive"` (which does not apply to array containment anyway), and legacy
mixed-case rows are found because the backfill gave them a normalized form — without touching what
they display.

### Vocabulary endpoint

**`GET /api/students/doubts/tags`** — auth required (student, faculty).

```jsonc
// 200  — `tag` is what you filter by, `display` is what you show
{ "tags": [{ "tag": "recursion", "display": "Recursion", "count": 12 },
           { "tag": "dbms",      "display": "DBMS",      "count": 9 }] }
```

`display` is the most common original casing seen in `labels` for that normalized tag, ties broken by
most recent. It is the canonical form: what autocomplete offers *and* what every chip renders.

Implemented as a raw aggregate over the unnested `labelsNormalized` array, joined back to `labels`
for the modal casing. Grouping on the normalized column is what makes the count correct —
`Recursion` and `recursion` are one row with a count of 12, not two rows of 7 and 5.

**The response is not capped.** An earlier draft returned the top 50 by count, which is right for an
autocomplete and wrong for a display map: a long-tail tag missing from the response would fall back
to its raw casing, and the divergence this section exists to remove would survive in exactly the
places nobody checks. The full list is a few hundred short strings at any realistic corpus size —
smaller than one doubt's description. Autocomplete slices the top N client-side.

If the tag count ever reaches the point where this is a real payload, that is the evidence that
justifies a `Tag` table, and the decision above gets revisited on the merits.

Cached in TanStack Query for five minutes and invalidated on doubt create/edit, so a newly coined tag
becomes canonical immediately for its author rather than after the stale window.

Registered **before** `/doubts/:id` in `src/routes/students.ts`, or `tags` is captured as a doubt id
— the same ordering hazard already called out for `/complaints/similar` at `students.ts:70`.

### Frontend

- `useTagVocabulary()` hook — fetches the map once, shared across every consumer via the query cache.
- `<Tag>` chip component: takes the normalized key, renders `vocabulary[key]?.display`, falls back to
  the raw label only while the map is still loading. Clicking it sends that same key to `?tag=`.
  Every one of the four render sites goes through this component — a chip rendered directly from
  `labels` anywhere is the bug this design is guarding against, so it is worth a lint rule or a
  code-review note.

  The normalized key comes **from the server**: doubt responses return `labelsNormalized` alongside
  `labels`, positionally aligned by `prepareTags`. The alternative — reimplementing `normalizeTag` in
  the frontend — puts the same rule in two languages in two repos that deploy independently, and the
  day they disagree is the day chips silently stop resolving. Shipping the column costs a few bytes
  per doubt and removes that class of bug entirely.
- `TagInput` replacing the raw comma-separated text field at `DoubtCommunity.tsx:64`: antd `Select`
  in `mode="tags"`, fed by the same vocabulary, showing `display` and counts. Typing `recur` surfaces
  `Recursion (12)`; picking it stores `Recursion`. A student who types their own casing keeps it in
  the record, matches the same filter bucket, and sees it rendered canonically like everyone else.
- The active tag filter appears as a dismissible chip next to the existing status/subject/semester
  filters.
- Tag state lives in the URL query string, not component state, so a filtered list is shareable and
  survives a refresh.

## Acceptance criteria

1. Creating a doubt with `["Recursion", " recursion ", "DP"]` stores `labels` as
   `["Recursion", "DP"]` — casing preserved, duplicate-after-normalization dropped, order kept — and
   `labelsNormalized` as `["recursion", "dp"]`.
2. Editing a doubt updates both columns consistently.
3. A tag over `MAX_TAG_LENGTH` is rejected with 400.
4. More than `MAX_TAGS_PER_DOUBT` tags is rejected with 400.
5. A tag normalizing to the empty string (e.g. `"!!!"`) is dropped from both columns.
6. `GET /api/students/doubts?tag=recursion` returns only doubts carrying that tag.
7. `?tag=Recursion` and `?tag=recursion` return identical results.
8. Two `tag` parameters return only doubts carrying **both**.
9. A pre-existing doubt whose `labels` reads `["Recursion"]` is returned by `?tag=recursion` after
   the backfill, and its stored value is unchanged.
10. Two doubts stored as `Recursion` and `recursion` render **identical** chips, in the canonical
    casing, on every surface that shows tags.
11. A tag that appears on exactly one doubt still renders canonically — it is present in the
    vocabulary response, which is uncapped.
12. Running the backfill twice produces the same result and leaves `labels` byte-identical to its
    pre-backfill value.
13. `GET /api/students/doubts/tags` returns one entry per normalized tag, with `display` set to the
    most common original casing and a count summing every casing variant.
14. Creating a doubt with a brand-new tag makes that tag canonical without waiting out the cache.
15. The vocabulary endpoint is not shadowed by the `/doubts/:id` route.
16. Clicking a tag chip anywhere filters the list and updates the URL.
17. Reloading a filtered URL restores the filter.
18. `c++` survives normalization intact, and renders as `C++` if that is the canonical casing.

## Implementation notes 2026-09-21

Built. 27 unit tests for `src/utils/tags.ts` plus route coverage in
`bookmarks.test.ts` (the vocabulary endpoint shares the shadowing test).

**The migration has not been run.** `prisma/migrations/20260921110000_cc20_add_doubt_labels_normalized`
is written and additive, but nobody has applied it — every environment still has a
`Doubt` table with no `labelsNormalized` column, so the tag filter and vocabulary
endpoint will error until someone runs `npx prisma migrate deploy`. Announce it first.

The backfill lives in the migration SQL rather than only in a script, so a fresh
database and an existing one converge. `src/scripts/normalizeDoubtLabels.ts` is still
the authoritative, re-runnable version if `normalizeTag` ever changes — and it can be
re-run precisely because `labels` is never written to.

One deviation: `MAX_TAG_LENGTH` and `MAX_TAGS_PER_DOUBT` are duplicated in
`CampusCure_Frontend/src/lib/tagLimits.ts` so the form can fail fast. The normalization
*rule* is deliberately not duplicated — the normalized key travels with each doubt
instead, so it exists in one language only.

## Test plan

- **Unit:** `normalizeTag` / `normalizeTags` — casing, whitespace, dedupe, cap, empty results, and
  the `c++` / `c#` / `node.js` cases specifically. The paired helper always returns two arrays of the
  same length, in the same order.
- **Integration:** `getDoubts` with one tag, two tags, mixed-case input, an unknown tag (empty list,
  not an error), and a legacy row. Responses carry `labels` and `labelsNormalized` positionally
  aligned. The vocabulary endpoint across student and faculty roles, its `display` selection, its
  modal-casing tie-break, that a count-of-one tag is present (criterion 11), plus a non-shadowing
  assertion.
- **Component:** the chip renders canonical display for every casing variant of one tag
  (criterion 10), and falls back to the raw label while the vocabulary is loading.
- **Backfill:** run against a fixture with mixed casing, snapshot `labels` before and after and
  assert equality (criterion 10), then run it a second time and assert the same.
- **Manual:** create a doubt with messy tags, confirm the chips render as typed, filter by one,
  share the URL to a second browser.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backfill mangles existing labels | Low | Low | It cannot: the script writes only `labelsNormalized`. Asserted by criterion 10 |
| A write path updates one column and not the other | Medium | Medium | One helper returns both; both call sites use it; criterion 2. Worst case is a stale filter, never lost data, and re-running the backfill repairs it |
| Tag sprawl — hundreds of one-use tags | Medium | Low | Autocomplete pushes toward reuse; cap of 5 per doubt; a moderation UI stays out of scope until there is evidence |
| Same tag displayed in several casings across cards | Medium | Low | Resolved, not accepted: every chip renders the canonical `display`. Criterion 10 |
| A render site bypasses the chip component and shows a raw label | Medium | Low | One shared component; criterion 10 checks *every* surface, not just the card |
| Canonical casing flips as counts shift (`DBMS` → `Dbms`) | Low | Low | Modal casing is stable once a tag has any adoption; ties break by most recent. Cosmetic and self-correcting |
| GIN index adds write cost | Low | Low | Negligible at this corpus size; droppable without code changes |
| `?tag=` collides with a future `?tags=` CSV form | Low | Low | Pick the repeatable form now and document it |

## Rollback

Fully reversible, which is the point of the derived-column design.

Revert both repos and drop `labelsNormalized` along with its index. `labels` is byte-identical to its
pre-CC-20 state — the backfill only ever wrote the other column — so no dump is required and nothing
authored by a student is lost. The existing write path continues to work untouched.

Re-applying later is just re-running the backfill.

## Open questions

1. Should faculty be able to add tags to a student's doubt? They already moderate answers, and they
   are better at taxonomy than the asker. Leaning yes, but it needs a line in the authz matrix.
2. Cap at 5 tags, or 3? Stack Overflow uses 5 for a corpus many orders of magnitude larger; 5 is
   probably generous here. Cheap to change — it is one constant.
3. ~~Should `labelsNormalized` be omitted from API responses?~~ **Resolved: no, it ships.** The
   client needs the key to look up canonical display, and deriving it in the frontend would duplicate
   `normalizeTag` across two independently deployed repos. It is a lookup key, not display text, and
   the shared chip component is what stops it being rendered.
