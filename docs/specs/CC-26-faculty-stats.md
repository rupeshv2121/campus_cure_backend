# CC-26: Faculty performance statistics

| | |
|---|---|
| **Status** | **Implemented** 2026-10-02. Queries and endpoints verified against the live database |
| **Phase** | 2 |
| **Branch** | `feat/CC-26-faculty-stats` |
| **Repos** | both |
| **Depends on** | CC-25 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | — |

## Problem

Nobody can tell how quickly doubts and complaints are handled. A faculty member cannot see their own
response times, and an admin assigning complaints has no figure for who is overloaded or slow, beyond
counting rows by hand. The data has existed all along: `Answer.createdAt`, `moderatedAt`,
`Complaint.assignedAt`, `resolutionDate`, `slaDueAt` (CC-31), `feedbackRating` and
`AnswerDraft.reviewedAt` (CC-12).

## Goal

Each faculty member sees their own response and resolution figures, with a department median for
context where one can be shown safely. Admins see the same figures for every faculty member, for
oversight.

## Non-goals / Out of scope

- **A public leaderboard.** Ranking named faculty publicly rewards answering many easy doubts, and
  creates political risk with the people who approve the deployment (see ROADMAP, CC-26). No route
  shows a named faculty member's numbers to students or to other faculty.
- Ranking or sorting by any metric. The admin table is sorted by name.
- Targets, alerts or consequences tied to the numbers.
- History or trends over time. Each request covers one window: 30, 90 or 365 days.

## Design

### What is measured

| Area | Figure | Definition |
|---|---|---|
| Doubts | Response time (median, slowest 10%) | Doubt posted → this person's **first** answer to it. A follow-up answer is not counted as a second, faster response |
| | Answers, accepted, upvotes | Answers posted in the window |
| Moderation | Student answers reviewed, median review time | `moderatedAt − createdAt`. Reviewing one's own answer is excluded |
| | AI drafts reviewed / approved / edited | CC-12 drafts by `reviewedAt` |
| Complaints | Resolution time (median) | `assignedAt` → `resolutionDate`, the moment the faculty member marked it resolved. The student's confirmation delay is not counted against them |
| | Within SLA | Resolved complaints that had a `slaDueAt` and were resolved by it |
| | Average rating | `feedbackRating` on complaints resolved in the window |
| | Open now, escalated | Currently ASSIGNED or IN_PROGRESS; escalated after assignment |

**Medians, not means.** One complaint left open over a vacation would otherwise dominate a
quarter's average.

### Privacy rules

1. **Small samples are withheld.** A timing, SLA rate or rating based on fewer than 3 items is
   returned as `null` and shown as "—" with the reason. Counts are always shown. Two data points
   are an anecdote, and "median response: 40 h" from two doubts invites the judgement this feature
   must not invite.
2. **No department figure for small departments.** Below 3 faculty, `benchmark` is `null`. With
   two members, the median plus your own figure gives away the other person's.
3. **Opening one person's record is audited.** `GET /api/admin/faculty/:id/stats` writes a
   `faculty.stats_view` entry to the CC-61 audit log. The overview is not logged, because it is
   the routine oversight screen.

### Endpoints

| Endpoint | Roles | Returns |
|---|---|---|
| `GET /api/faculty/me/stats?days=` | FACULTY | `{ days, stats, benchmark }` for the caller |
| `GET /api/admin/faculty/stats?days=&department=` | ADMIN, SUPER_ADMIN | `{ days, faculty: [{ id, name, userID, department, isTeaching, stats }] }` |
| `GET /api/admin/faculty/:id/stats?days=` | ADMIN, SUPER_ADMIN | `{ days, faculty, stats, benchmark }`, audited |

`days` accepts 30, 90 or 365 and falls back to 90 for anything else, because an arbitrary window
means an arbitrary scan.

### Modules

| File | Purpose |
|---|---|
| `src/services/faculty/stats.ts` | Five grouped SQL queries (answers, first responses, moderation, drafts, complaints) using `percentile_cont`; withholding; department benchmark |
| `src/controllers/facultyStatsController.ts` | The three handlers. A new file rather than more lines in `facultyController.ts`, which CC-72 exists to split up |
| Frontend `pages/faculty/MyPerformance.tsx` | Own figures, `/faculty/performance` |
| Frontend `pages/admin/FacultyPerformance.tsx` | Table and detail drawer, `/admin/faculty-performance` |
| Frontend `components/facultyStats/FacultyStatsView.tsx` | Shared by both, so faculty and admins see the same presentation |

Each query is grouped by user, so the admin overview costs the same five queries for forty faculty
as for one. No migration.

## Acceptance criteria

1. A faculty member sees their own figures and never anyone else's.
2. Students and faculty get 403 on both admin routes. Students get 403 on the faculty route.
3. Admins and super admins see every approved faculty member, sorted by name.
4. A figure based on fewer than 3 items is shown as "—" with the reason, never as a number.
5. A department with fewer than 3 faculty shows no comparison, and the page says why.
6. Opening one faculty member's detail as an admin writes a `faculty.stats_view` audit entry.
7. An unsupported `days` value falls back to 90.
8. Response time counts only each person's first answer per doubt.
9. Reviewing one's own answer does not count as moderation.

## Test plan

- **Unit** (`facultyStats.test.ts`, 13 tests): window parsing, median, row mapping and unit
  conversion, withholding below the sample minimum (4), zeroed rather than missing stats,
  ignoring rows for other users, no benchmark under 3 faculty (5), benchmark medians excluding
  members with no data.
- **Authz matrix:** three new rows across all five roles (1, 2).
- **Frontend:** `facultyStatsFormat.test.ts` covers how withheld and real figures display.
- **Live, 2026-10-02:** the SQL ran against the production schema. As the seed faculty account,
  `GET /faculty/me/stats` returned correct figures, the student account got 403 on it, faculty got
  403 on the admin overview, and `days=99999` fell back to 90. Criteria 3 and 6 still need an admin
  login to check in the browser.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Figures used to rank or pressure staff | Medium | High | No public route, no ranking, small samples withheld, reads of individuals audited |
| A small department identifies people | High today: every department has under 3 faculty | Medium | No benchmark below 3 faculty |
| Stale `resolutionDate` after a student rejects a resolution | Low | Low | Only counted while the status is PENDING_CONFIRMATION or RESOLVED |
| Query cost at 365 days | Low | Low | Grouped queries over indexed foreign keys; windows limited to three values |

## Rollback

Remove the three routes and the two nav entries. There is no schema change and nothing to clean up.
Audit entries already written stay, as audit entries should.

## Open questions

1. Should departmental aggregates be visible to students, as the roadmap allows? Not built: no
   department has 3 faculty yet, so it would show nothing.
2. Should non-teaching staff, who are assigned complaints but never answer doubts, see only the
   complaints section?
