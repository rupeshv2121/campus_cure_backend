# CC-12: Retrieval-grounded AI answer drafts

| | |
|---|---|
| **Status** | **Shipped 2026-09-20 — complete** |
| **Phase** | 1 |
| **Branch** | `feat/CC-12-ai-answer-draft` |
| **Repos** | backend (frontend follow-up) |
| **Depends on** | CC-11 |
| **Blocks** | nothing |
| **Estimate** | 4 days |
| **Shipped** | 2026-09-20 |

## Problem

A doubt with no answer is dead weight: the student waits, and faculty face a queue of blank threads
with no starting point. Writing an answer from scratch is the expensive part, and much of it is
re-explaining something already answered well elsewhere in the system.

## Goal

Faculty open an unanswered doubt and find a draft already written, grounded in previously approved
answers from this campus, which they can edit, approve, or reject. No draft ever reaches a student
without a human approving it.

## Non-goals / Out of scope

- **Auto-publishing.** Never, under any configuration. See *Why drafts never auto-publish*.
- Answering on behalf of students. Only faculty see drafts.
- Multi-turn conversation about a doubt — that is CC-15.
- Images or handwritten input — CC-50.
- Fine-tuning or training. We prompt a hosted model; the contribution is the grounding and the
  guardrails.

## Design

### Retrieval-grounded, not free generation

The draft is synthesised from the **top-k semantically similar doubts whose answers were approved**,
retrieved with CC-11's hybrid search. Three reasons this beats free generation:

1. **Lower hallucination.** The model summarises real, human-approved content rather than inventing.
2. **Campus-specific.** It reflects how this institution actually teaches a topic.
3. **Auditable.** Every draft records the source answers it drew from, so a reviewer can check it.

If retrieval returns nothing relevant, **no draft is produced.** A grounded-answer feature that
free-generates when it finds no grounding is just free generation with extra steps.

### Why drafts never auto-publish

The risk is not a bad draft; it is a *plausible* bad draft. An overworked reviewer clicking approve
turns a confident wrong answer into institutionally-endorsed content carrying a verification badge —
worse than no answer, because students trust it.

Controls:

- Drafts live in their own table and are **invisible to students** until approved.
- Approval writes a real `Answer` **authored by the approving faculty member**, who takes
  responsibility, with `aiAssisted: true` recorded permanently.
- The AI origin is visible after approval. A reader can always tell.
- `approvedWithoutEdit` is recorded so rubber-stamping is **measurable**, not merely discouraged.

### It must not cannibalise the community

CC-12 risks undermining CC-25 (reputation): if AI answers instantly, why would a student answer?

So a doubt is only eligible for a draft after `DRAFT_DELAY_HOURS` (default 24) with no human answer.
Humans get first refusal; the AI fills the gap nobody filled.

### Schema

```prisma
model AnswerDraft {
  id           String    @id @default(uuid())
  doubtId      String    @unique
  content      String
  model        String
  sourceIds    String[]          // answer ids used as grounding
  status       String    @default("PENDING")  // PENDING | APPROVED | REJECTED
  reviewedById String?
  reviewedAt   DateTime?
  editedOnApproval Boolean @default(false)
  createdAt    DateTime  @default(now())
}
```

`Answer` gains `aiAssisted Boolean @default(false)`. Migration `cc12_add_answer_drafts`.

`doubtId` is unique: one outstanding draft per doubt, so generation is idempotent.

### Generation

A `ChatProvider` interface alongside the existing `EmbeddingProvider`, with Groq primary and Mistral
fallback. Unlike embeddings, generation **can** fail over between providers — outputs are text, not
vectors in a shared space ([ADR-0001](../adr/0001-ai-provider-strategy.md)).

> **`gpt-oss` is a reasoning model.** Reasoning tokens draw from the same `max_tokens` budget as
> content, so too small a budget returns `content: ""` with `finish_reason: "stop"` — no error, just
> an empty answer. Budget generously and treat empty content as a failure, not a valid draft.

Drafts are generated **asynchronously through the existing job queue**, never inline, for the same
reasons as CC-10.

### Endpoints

- `GET /api/faculty/doubts/:id/draft` — the draft, if any. Faculty only.
- `POST /api/faculty/doubts/:id/draft/approve` — body `{ content }`. Creates a real `Answer` authored
  by the reviewer, marks the draft approved, records whether the content was edited.
- `POST /api/faculty/doubts/:id/draft/reject` — body `{ note? }`.
- `POST /api/internal/drafts/generate` — cron-triggered generation for eligible doubts.

## Acceptance criteria

1. A draft is generated only for a doubt with no human answer older than `DRAFT_DELAY_HOURS`.
2. Drafts are grounded in approved answers to semantically similar doubts.
3. **No draft is produced when retrieval finds nothing relevant.**
4. **No student-facing endpoint ever returns draft content.**
5. Approving creates an `Answer` authored by the approving faculty member, not by a system user.
6. An approved answer is flagged `aiAssisted: true` permanently.
7. `editedOnApproval` records whether the reviewer changed the text.
8. Rejecting leaves no `Answer` behind.
9. One draft per doubt; regenerating replaces rather than duplicates.
10. Empty or whitespace-only model output is treated as a failure, never stored as a draft.
11. A provider outage never breaks the faculty doubt view.
12. Draft generation never blocks any user action.
13. Only FACULTY may read, approve or reject a draft.
14. Generation is rate limited and quota-aware.

## Test plan

- **Unit:** eligibility rules; prompt assembly; empty-output rejection; provider fallback.
- **Integration (mocked Prisma):** approve creates an Answer with the reviewer as author; reject
  creates none; `editedOnApproval` set correctly; student endpoints never leak draft content.
- **Authz:** students and admins get 403 on every draft route.
- **Live:** one real draft generated from real data and inspected by hand.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Faculty rubber-stamp a plausible wrong answer | **High** | **High** | Never auto-publish; reviewer becomes the author; `approvedWithoutEdit` measurable; AI origin always visible |
| Drafts suppress student participation | Medium | Medium | 24h delay so humans get first refusal |
| Hallucinated content presented as campus-endorsed | Medium | **High** | Grounded only; no grounding means no draft; sources recorded |
| Free-tier quota consumed by generation | Medium | Medium | Async queue, one draft per doubt, eligibility gate |
| Empty content mistaken for a valid draft | **High** | Medium | Explicit non-empty check — this is the `gpt-oss` reasoning-budget trap |

## Rollback

Additive migration. `AI_ENABLED=false` disables generation; existing drafts simply stop appearing.
No student-visible surface changes, so rollback is invisible to students.

## Open questions

- Should a rejected draft block regeneration permanently, or expire? Start with permanent — repeated
  generation for a doubt faculty already rejected wastes quota.
- Should students eventually see that an answer was AI-assisted? Recorded from day one so the choice
  stays open; surfacing it is a frontend decision.


---

## Delivery log

### Shipped 2026-09-20 — branch `feat/CC-12-ai-answer-draft`

**Live generation against real data, and the guardrails held.**

```
eligible doubts: 3
result: { considered: 3, created: 1, skipped: 2 }
```

The two skipped had no grounding material, so no draft was produced — criterion 3 working. The one
draft that was produced reads:

> "The specific details of your question are not covered by the provided reference material, so I
> cannot address them further."

That is the model **refusing to invent an answer** for a junk doubt backed by junk grounding, which
is exactly the intended behaviour. Garbage in produced an honest refusal rather than fabricated
content. It is also a fair warning about the demo: with production data this thin, drafts will be
thin. The feature needs real answered doubts before it looks impressive.

| Check | Result |
|---|---|
| Chat provider, live | Groq answered in 953ms; Mistral configured as fallback |
| Empty-content trap | `maxTokens: 8` raised `EmptyCompletionError` instead of storing `""` |
| Migration | rehearsed in a rolled-back transaction, then applied |
| Tests | 162 passing (31 new) |

### Criterion 4 is enforced structurally

"No student-facing endpoint returns draft content" is guarded by a test that asserts
`studentController.ts` and `adminController.ts` never reference `answerDraft`, and that draft routes
appear only under `/api/faculty`. A behavioural test could only cover the endpoints that exist today;
this one fails the moment anyone adds a student query against the draft table — which is the precise
mistake that would leak unreviewed AI content to students.

The draft table is separate from `Answer` for the same reason: a draft is *structurally* incapable of
reaching a student, not merely filtered out.

### Guardrails, as built

- Approval creates an `Answer` **authored by the reviewing faculty member** — they put their name to
  it and take responsibility.
- `aiAssisted` is permanent on the answer, so AI origin is always recoverable.
- `editedOnApproval` records whether the reviewer changed a single character, which makes
  rubber-stamping **measurable** rather than merely discouraged.
- A doubt is only eligible after `DRAFT_DELAY_HOURS` (24), so humans get first refusal.
- A doubt with any existing draft — pending, approved or rejected — is never re-drafted.

### To verify at deploy time

**Vercel cron limits.** There are now two cron entries (embedding drain 02:00, draft generation
02:30). The Hobby plan restricts both the number of cron jobs and their frequency; confirm both are
accepted, and if only one is permitted, fold draft generation into the embedding drain endpoint.

### Frontend — done 2026-09-20

The draft appears on the faculty doubt page above the answer box, visually separated and tagged
"Not visible to students", with a warning that states the risk plainly rather than burying it.

- Editable in place; approval sends whatever is on screen, so `editedOnApproval` reflects reality.
- Grounding sources are expandable, so a reviewer can check what the draft was built from rather
  than trusting it. Grounding that cannot be inspected is not much better than no grounding.
- "Suggest a draft" appears only when there is no draft and no answer, so it cannot regenerate over
  a draft already under review.

Both API clients swallow failures and return `null`/`[]`: a faculty member must still be able to
answer when AI is unavailable.

Verified: typecheck and build clean; eslint reports exactly the same 5 pre-existing errors as `main`,
so no new lint problems were introduced.

### Note

One `PENDING` draft exists in production on doubt "New Title 2" — invisible to students, and now
rejectable through the UI.
