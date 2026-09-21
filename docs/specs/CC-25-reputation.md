# CC-25: Reputation and badges

| | |
|---|---|
| **Status** | **Shipped 2026-09-21** — backend and frontend |
| **Phase** | 2 |
| **Branch** | `feat/CC-25-reputation` |
| **Repos** | both |
| **Depends on** | none |
| **Blocks** | CC-26 |
| **Estimate** | 4 days |
| **Shipped** | 2026-09-21 |

## Problem

Answering someone else's doubt earns nothing. `Answer.upvotes` is incremented and displayed on
that one answer, and that is where the signal dies — there is no way to see that a student has
written thirty good answers, and no reason for them to write the thirty-first.

`StudentProfile` already has `doubtsAsked` and `doubtsSolved`, and `FacultyProfile` has
`doubtsSolved`. So the project already wanted this and solved it with two counters that nothing
reads and nothing keeps accurate.

The doubt community is the half of CampusCure that depends on people showing up for each other.
Complaints work because staff are paid to handle them; doubts work only if answering is worth
something.

## Goal

Contributing earns reputation, reputation is visible, and the obvious ways to farm it do not
work.

## Non-goals / Out of scope

- **Faculty rankings.** CC-26, and deliberately private there. Publicly ranking named faculty by
  response time creates political risk with the people who approve the deployment, and rewards
  answering many easy doubts over one hard one.
- **Privileges gated on reputation** — "50 points to comment", that sort of thing. Adding a
  barrier to a campus tool with 25 users would make it worse, not better.
- **Downvotes.** There is no downvote in the product and this is not the spec to add one.
- **Retroactive scoring of existing content.** See *Backfill* — it is a deliberate choice, not an
  omission.
- **Decay.** Reputation that evaporates punishes people for the crime of having exams.

## Design

### An event ledger, not a counter

`User.reputation` is a denormalised total, but the truth is a `ReputationEvent` row per award.
A bare counter cannot answer "why do I have 340 points?", cannot be recomputed after a bug, and
cannot be reversed when the upvote that caused it is withdrawn.

```prisma
model ReputationEvent {
  id         String   @id @default(uuid())
  userId     String        // who earned it
  delta      Int
  reason     String        // "answer.upvoted", "answer.accepted", ...
  sourceType String        // "Answer" | "Doubt"
  sourceId   String
  actorId    String?       // who caused it - the upvoter, the accepter
  createdAt  DateTime @default(now())

  @@unique([userId, reason, sourceType, sourceId, actorId])
  @@index([userId, createdAt])
}
```

**The unique constraint is the anti-gaming mechanism**, not a nicety. One upvoter can cause one
award for one answer, at the database level. Un-upvoting deletes the row and reverses the points;
re-upvoting re-awards once. No amount of clicking produces two.

### The three ways to farm it, and what stops each

| Attack | Control |
|---|---|
| Upvote your own answer | `actorId === userId` scores zero. Checked before the write |
| Upvote the same answer repeatedly | Composite unique — one row per (earner, reason, source, actor) |
| Two accounts upvoting each other all day | `REPUTATION_DAILY_CAP` — points earned per user per day are capped |

The daily cap is the weakest of the three and the most important to get right, because the first
two are structural and this one is a judgement. It caps *earning*, not *voting*: the upvote still
registers and still counts on the answer, it just stops paying. Silently dropping the vote would
be worse — the voter would think their click did nothing.

### Points

| Reason | Points | Why |
|---|---|---|
| `answer.accepted` | 15 | The asker says this solved it. The strongest signal available |
| `answer.upvoted` | 10 | Somebody else found it useful |
| `answer.approved` | 2 | Faculty moderation passed. Small: it is a floor, not an achievement |
| `doubt.upvoted` | 2 | Asking a question others share has value, but less than answering |

Answering is worth roughly five times asking, deliberately. A forum where asking scores well
fills with questions and empties of answers.

### Ranks

Derived from the total, never stored — a stored rank is a second thing to keep in sync.

| Rank | From |
|---|---|
| Newcomer | 0 |
| Contributor | 50 |
| Helper | 150 |
| Mentor | 400 |
| Expert | 1000 |

Thresholds are guesses on a corpus of seven doubts. They are constants in one file, and the
right time to set them properly is when there is a distribution to look at.

### Awarding must not break the action

`awardReputation` never throws. An upvote that fails to score is a missing point; an upvote that
500s is a broken button. Same reasoning as CC-40's email and CC-61's audit write.

Where the caller already has a transaction the award joins it — the upvote and its points commit
together or not at all.

### Backfill

**Existing content is not scored.** Seven doubts and their answers would produce a leaderboard
decided by who happened to post before the feature existed, and reputation is supposed to
motivate future behaviour, not rank history. Everyone starts at zero on the same day.

This is stated because "you forgot to backfill" is the obvious reading otherwise.

### Config

| Var | Default |
|---|---|
| `REPUTATION_ENABLED` | `true` |
| `REPUTATION_DAILY_CAP` | `50` |

## Acceptance criteria

1. Upvoting an answer awards its author 10 points.
2. Removing that upvote reverses them.
3. Re-upvoting awards once more, not twice.
4. The same user upvoting twice cannot award twice.
5. Upvoting your own answer awards nothing.
6. Upvoting your own doubt awards nothing.
7. Accepting an answer awards its author 15.
8. Faculty approving an answer awards 2.
9. Upvoting a doubt awards its author 2.
10. Earnings stop at `REPUTATION_DAILY_CAP` in a day.
11. A capped upvote still registers as an upvote.
12. With `REPUTATION_ENABLED=false` nothing is awarded and no table is touched.
13. `User.reputation` matches the sum of that user's events.
14. An award failure does not break the upvote.
15. Rank is derived correctly at each threshold.
16. The leaderboard returns students ordered by reputation.
17. The leaderboard excludes erased accounts.
18. A user can see their own reputation history.

## Test plan

- **Unit:** points per reason; self-award suppression; the daily cap; rank thresholds; reversal;
  never-throws; transaction pass-through.
- **Integration:** upvote → score → un-upvote → reverse, through the real handlers; leaderboard
  ordering and role access.
- **Manual:** upvote an answer from a second account, watch the author's total and rank move.

## Implementation notes 2026-09-21

Backend built, migration applied. 23 tests; 614 backend tests total.

**Frontend shipped 2026-09-21**, in a second pass: a Reputation page (score, rank,
progress to the next one, daily-cap usage, the ledger and the leaderboard), routed for
students and faculty alike since the endpoints authorize both.

The change that matters most is not the page. Author reputation now appears **beside
each answer**, which meant adding `reputation` to four author `select`s. A leaderboard
nobody opens does not help anyone judge an answer; a number next to the author does.

It is deliberately silent at zero — a "0" beside a newcomer's first answer discourages
exactly the person the community most needs to keep.

Two of my own test expectations were wrong and I fixed the tests, not the code: a
leaderboard fixture at 120 points asserted rank `Helper` when 120 is `Contributor`
(Helper starts at 150).

While wiring this up I also found a pre-existing typecheck failure in the CC-64 test
files — `tsc` on the build config skips tests, so `npm run build` had been passing over
it. Both files now use a shared `argOf` helper. Worth knowing: `npm run typecheck` is
the gate for test files, not `npm run build`.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two accounts farm each other | Medium | Medium | Daily cap; composite unique; self-awards score zero |
| Denormalised total drifts from the ledger | Low | Medium | Events are the truth; a recompute script exists |
| Points discourage asking | Low | Medium | Asking still scores, at a fifth the rate |
| Thresholds are wrong | High | Low | Constants in one file; no behaviour gated on rank |

## Rollback

Revert and drop `ReputationEvent` and `User.reputation`. Additive migration; nothing else reads
them. Dropping loses the ledger, which is the only record of why anyone had the score they had.

## Open questions

1. Should `doubtsAsked` / `doubtsSolved` be retired in favour of the ledger? They are unreliable
   today. Left alone here because something may read them.
2. Is 50/day the right cap? Guessed. Needs a week of real data.
3. Should faculty earn reputation at all, or is that CC-26's private view? Currently they do —
   suppressing it would make a faculty member's answers look worthless to the student reading them.
