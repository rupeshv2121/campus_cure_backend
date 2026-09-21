# CC-31: SLA timers and automatic escalation

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied, clocks started |
| **Phase** | 3 |
| **Branch** | `feat/CC-31-sla-escalation` |
| **Repos** | backend |
| **Depends on** | CC-03 (shipped), CC-40 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | 2026-09-21 |

## Problem

**Correction, made after reading the data.** An earlier draft of this spec claimed nothing
increments `escalationCount` and that every row holds zero. That is wrong. `rejectComplaintResolution`
(`src/controllers/studentController.ts:2141`) increments it when a student rejects a resolution,
and **6 complaints in the live database already carry a non-zero count**. Escalation exists.

What does not exist is a *clock*. Every escalation today is **reactive**: it requires a student
to look at a complaint they were told was fixed, decide it is not, and say so. Nothing escalates
because time passed.

So the gap is the other half. A complaint nobody assigns, or that an assignee quietly sits on,
is never rejected by anyone — there is no resolution to reject — and therefore never escalates.
It waits forever. `slaDueAt` does not exist, nothing measures elapsed time against priority, and
the admin queue's "most escalated first" sort (`adminController.ts:1639`) can only ever surface
complaints a student complained about twice.

The machinery that *is* there — `escalationCount`, `ESCALATED_TO_SUPERADMIN`, `assignedAt`,
`pendingConfirmationAt` — is exactly what a timer needs, and none of it is wired to one.

CC-31 was blocked until now for a good reason: an SLA breach nobody is told about is just a
column. CC-03 and CC-40 gave it a channel that reaches someone who is not looking at the app.

## Goal

Every complaint carries a deadline from the moment it is filed. When the deadline passes, the
system notices, tells the people responsible, and — if it keeps passing — escalates to the super
admin, incrementing the counter the admin queue already sorts by.

## Non-goals / Out of scope

- **Auto-resolving a complaint the student never confirms.** `PENDING_CONFIRMATION` waits on the
  student, and closing their complaint on their behalf to make a metric look better is exactly
  the behaviour that teaches people the system lies. It reminds them, repeatedly, and waits.
- **Escalating against the student.** A complaint waiting on the reporter must never count as a
  staff SLA breach — see *Which clock is running*.
- **Per-category or per-department SLAs.** One table keyed by priority. Categories differ in
  repair time, but nobody has the data to set those numbers yet, and inventing them would be
  worse than one honest default.
- **Business hours / holiday calendars.** A 24-hour SLA is 24 wall-clock hours. Campus holidays
  are real and this is not the release to model them in.
- **Reassignment on breach.** Escalation raises visibility; a human still decides who picks it up.
- **A frontend SLA dashboard.** The roadmap scopes CC-31 to the backend. `slaDueAt` ships in the
  existing complaint responses so a later frontend can show it without another migration.

## Design

### Two clocks, never both

A complaint is always waiting on exactly one party, and only the two below are staff time:

| Status | Waiting on | Clock |
|---|---|---|
| `RAISED` | admin, to assign it | **assignment** |
| `ASSIGNED`, `IN_PROGRESS` | the assignee, to fix it | **resolution** |
| `PENDING_CONFIRMATION` | the student | none — reminder only |
| `ESCALATED_TO_SUPERADMIN` | super admin | none — already at the top |
| `RESOLVED` | nobody | none |

This distinction is the whole correctness argument. Running one undifferentiated timer would
escalate complaints against staff for the time a student spent not clicking "confirm", which
makes the metric worthless and the escalation unfair.

### `slaDueAt`, stored not computed

```prisma
slaDueAt         DateTime?
lastEscalationAt DateTime?
```

The deadline is written when the clock starts — on create, and again on assignment — rather than
derived from status timestamps on every sweep. Three reasons:

1. The sweep becomes one indexed query (`slaDueAt < now()`), not a scan plus arithmetic.
2. It is *visible*. An admin can be shown "due in 3 hours" without the frontend reimplementing
   the policy.
3. Changing the policy later does not retroactively rewrite history for complaints already in
   flight.

`lastEscalationAt` enforces a cooldown so a breached complaint is escalated once per
`SLA_ESCALATION_COOLDOWN_HOURS`, not once per sweep.

### The counter is shared with student rejection, deliberately

`escalationCount` is already incremented when a student rejects a resolution, and the sweep
increments the same column rather than introducing a second one.

That means the ladder counts **failures of either kind**. A complaint a student rejected once,
which then also blows its next deadline, reaches `SLA_MAX_ESCALATIONS` and goes to the super
admin — even though only one of those two failures was a missed deadline.

This is the intended behaviour, not an accident of sharing a column: "how many times has this
complaint failed its reporter" is the right question for the admin queue to sort by, and a
rejection is unambiguously a failure. Stated here because the alternative reading — that the
counter means "SLA breaches" — would make the ladder look wrong.

One consequence to know about: rejection does not set `lastEscalationAt`, so a previously
rejected complaint is not in cooldown and can escalate on the very first sweep it is overdue for.
Two of the eight live complaints are in exactly that position.

### Budgets

Hours, by priority — which runs **1 (Low) to 5 (Critical)**, matching the form and the database.
CC-14 records a bug where this was assumed backwards, so it is worth stating plainly.

| Priority | Assign within | Resolve within |
|---|---|---|
| 5 Critical | 4h | 24h |
| 4 High | 8h | 48h |
| 3 Medium | 24h | 96h |
| 2 Low | 48h | 168h |
| 1 Lowest | 72h | 240h |

These are **defaults, not measurements**. Nobody has resolution-time data yet; the numbers are
plausible starting points, tunable with `SLA_MULTIPLIER` without a deploy, and worth replacing
with real percentiles once the data exists. Said here so nobody later mistakes them for findings.

### The sweep

One step added to the existing consolidated `dailyHandler` in `src/routes/internal.ts`, beside
`embeddings`, `drafts`, `emails` and the purges. For each overdue complaint:

1. `escalationCount += 1`, `lastEscalationAt = now`.
2. Notify — assignee and admins on a resolution breach, admins on an assignment breach. Both go
   through `createNotification`, so CC-40 emails them for free.
3. After `SLA_MAX_ESCALATIONS`, move to `ESCALATED_TO_SUPERADMIN` and notify super admins.
4. Push `slaDueAt` forward by the cooldown, so the next sweep does not re-fire immediately.

Separately, `PENDING_CONFIRMATION` complaints older than `SLA_CONFIRMATION_REMINDER_HOURS` get a
reminder to the student, rate-limited the same way and **without** touching `escalationCount`.

**Granularity is one day, and that is a real limitation.** Vercel's Hobby plan caps cron
frequency, which is why the project already consolidated everything into one nightly job. A
4-hour critical SLA is therefore *measured* precisely — the breach time comes from stored
timestamps — but *acted on* at the next nightly run. The endpoint is also callable directly with
the internal secret, so a demo does not have to wait until 02:00.

### Config

| Var | Default | Purpose |
|---|---|---|
| `SLA_ENABLED` | `true` | Master switch. Off ⇒ no clock is set and the sweep no-ops |
| `SLA_MULTIPLIER` | `1` | Scales every budget. `0.001` makes a demo breach in seconds |
| `SLA_MAX_ESCALATIONS` | `2` | Escalations before the super admin takes it |
| `SLA_ESCALATION_COOLDOWN_HOURS` | `24` | Minimum gap between escalations of one complaint |
| `SLA_CONFIRMATION_REMINDER_HOURS` | `72` | Silence before a student is reminded to confirm |
| `SLA_SWEEP_BATCH_SIZE` | `50` | Complaints per sweep |

### Backfill

Existing complaints have no `slaDueAt`. A script (`backfillSlaDueAt.ts`) sets one from each
complaint's current status and timestamps. Long-overdue complaints would otherwise all escalate
on the first sweep, so the backfill **floors the deadline at 24 hours from now**: a system that
has never had SLAs starts its clock today rather than declaring everything a failure overnight.

## Acceptance criteria

1. Filing a complaint sets `slaDueAt` from its priority's assignment budget.
2. Assigning one resets `slaDueAt` from the resolution budget.
3. A critical complaint gets a shorter deadline than a low one.
4. Moving to `RESOLVED` clears `slaDueAt`.
5. Moving to `PENDING_CONFIRMATION` clears `slaDueAt` — staff are no longer the blocker.
6. The sweep ignores complaints whose deadline has not passed.
7. An overdue `RAISED` complaint increments `escalationCount` and notifies admins.
8. An overdue `ASSIGNED` complaint notifies its assignee.
9. A complaint reaching `SLA_MAX_ESCALATIONS` becomes `ESCALATED_TO_SUPERADMIN`.
10. An already-escalated complaint is not escalated again.
11. The cooldown prevents two escalations of one complaint in consecutive sweeps.
12. `PENDING_CONFIRMATION` never increments `escalationCount`.
13. An overdue `PENDING_CONFIRMATION` reminds the student, once per cooldown.
14. With `SLA_ENABLED=false`, no deadline is set and the sweep returns zeroes.
15. The sweep is capped at `SLA_SWEEP_BATCH_SIZE`.
16. A notification failure does not stop the remaining complaints being processed.
17. The backfill never sets a deadline less than 24 hours out.
18. `slaDueAt` appears in the student and admin complaint responses.

## Test plan

- **Unit:** budget selection per priority and status; `slaDueAt` on create/assign/resolve; the
  sweep — overdue selection, cooldown, escalation ladder, the `PENDING_CONFIRMATION` branch,
  batch cap, and one failure not stopping the rest.
- **Integration:** the internal sweep endpoint with and without the shared secret.
- **Manual:** file a complaint with `SLA_MULTIPLIER=0.001`, run the sweep endpoint, watch it
  escalate and the email arrive.

## Implementation notes 2026-09-21

Built, migration applied, backfill run. 41 tests (`slaPolicy.test.ts` 20,
`slaEscalation.test.ts` 21); 522 backend tests total.

**The problem statement in this spec was wrong and the live data caught it.** The first
draft claimed nothing increments `escalationCount`; in fact student rejection does, and
6 rows already carried a non-zero count. The Problem section is rewritten. The feature
is unchanged — what was missing was always the *clock*, not escalation itself — but a
spec that misdescribes the starting state is worse than no spec.

**The backfill floor earned its place.** All 8 live complaints with a staff clock would
have been instantly overdue on their original timestamps. Without the 24-hour floor the
first sweep would have escalated the entire history overnight, and two of them
(already at `escalationCount = 1` from a student rejection) would have gone straight to
the super admin. Verified after backfilling: `overdue: 0, dueSoon: 8`, and a manual
sweep escalated nothing.

The sweep runs **before** the email drain in the daily job. It queues the most
time-sensitive notifications the job produces; draining first would leave every
escalation notice in the outbox until the next night.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| First sweep escalates every historical complaint at once | High without care | High | Backfill floors deadlines 24h out; batch cap bounds any single run |
| Escalation spam to admins | Medium | Medium | Cooldown per complaint, cap on escalations, then it stops at the super admin |
| Email quota burned by a burst of breaches | Medium | Medium | Batch cap; CC-03 caps the drain; noisy types already excluded by CC-40 |
| Budgets are guesses and prove wrong | High | Low | `SLA_MULTIPLIER` tunes without a deploy; documented as defaults, not findings |
| Daily granularity misses a 4-hour SLA by hours | Certain | Low | Documented; endpoint callable on demand; the alternative is a paid cron tier |
| Staff blamed for student delay | Low | High | Two clocks; `PENDING_CONFIRMATION` never escalates |

## Rollback

Revert the code. The migration adds two nullable columns and is additive — leaving it is
harmless, and dropping it loses the deadlines. `escalationCount` values already incremented are
real history and are not reset.

To stop escalation without a deploy, set `SLA_ENABLED=false`.

## Open questions

1. Should budgets be per category once there is data? A broken fan and a network outage are not
   the same repair. Revisit with real resolution times, not intuition.
2. Should a breached complaint auto-reassign to another faculty member in the same department?
   That needs CC-27's staff directory to have anyone to reassign *to*.
3. Is 72 hours the right silence before nudging a student to confirm? Guessed, like the budgets.
