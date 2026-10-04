# CC-72: Controller split (stage 1 of the service refactor)

| | |
|---|---|
| **Status** | **Stage 1 done** 2026-10-04 (split by area). **Stage 2 done for the write paths** 2026-10-04 (complaints and answer review moved into services) |
| **Phase** | 7 |
| **Branch** | `refactor/CC-72-services` |
| **Repos** | backend |
| **Depends on** | CC-04 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 5 days (stage 1 about 1) |
| **Shipped** | — |

## Problem

Three controllers had grown to 2,682 (student), 2,112 (admin) and 1,525 (faculty) lines. Every
feature touched one of them, so unrelated changes collided, and finding "where are complaints
assigned?" meant searching a 2,000-line file.

## Goal of stage 1

Every handler lives in a file named for what it does, and the code inside is byte-for-byte what it
was. A refactor that also changes behaviour cannot be reviewed as either, so stage 1 changes none.

## What moved

| Was | Now |
|---|---|
| `studentController.ts` (2,682) | `student/` with `profile` (4 handlers), `complaints` (7), `doubts` (14), `answers` (7), and `shared` |
| `adminController.ts` (2,112) | `admin/` with `profile` (3), `users` (11), `complaints` (8), `stats` (3), `settings` (3), and `shared` |
| `facultyController.ts` (1,525) | `faculty/` with `profile` (4), `complaints` (2), `doubts` (9), `drafts` (4), and `shared` |

Each old file is now an index of `export * from "./<area>/…"`, so **no route import changed**.
`authController.ts` (627 lines after CC-62 moved session issuance into `services/auth/session.ts`)
and the newer single-purpose controllers stay as they are. The largest file is now
`student/doubts.ts` at about 1,100 lines.

## How

Not by hand. A script used the TypeScript compiler API:

1. Parse the controller and walk its top-level statements, keeping each one's leading comments.
2. Assign every exported handler to a module by an explicit name map. An unassigned export, or a
   name that does not exist, aborts the run, so nothing can be silently dropped.
3. Move non-exported helpers and types to `shared.ts` and export them. Module-level state therefore
   stays a single instance (there was none, but the rule makes it safe).
4. Give every module the original import block, then run TypeScript's own `organizeImports`, which
   uses type information, to delete whatever that module does not use.

## Verification

- `tsc` clean; all 955 tests pass, including the permission matrix across every role.
- **Found and fixed:** `draftIsolation.test.ts`, the CC-12 guard that student and admin code never
  touch unreviewed AI drafts, read only the old controller files. After the split those are
  re-export lists, so the guard would have passed vacuously forever. It now reads each controller's
  whole directory. To prove it, a probe reference was added to `student/doubts.ts`: the test failed,
  then passed again once the probe was removed.

## Stage 2: business rules into services

Every handler that **changes state** in the complaint and answer workflows now just reads the request,
calls a service, and maps `ComplaintError`, `AnswerReviewError` or `AttachmentError` to a response.
The rules live in services that are tested without HTTP.

| Service | Replaces | Tests |
|---|---|---|
| `services/complaints/lifecycle.ts` | Staff and admin status changes (two near-copies with undocumented differences, now one function with the differences named), student confirm/reject, feedback | `complaintLifecycle.test.ts` (20) |
| `services/complaints/assignment.ts` | Admin assignment and super-admin reassignment of escalated complaints | `complaintAssignment.test.ts` (9) |
| `services/complaints/filing.ts` | Raising a complaint | `complaintFiling.test.ts` (7) |
| `services/doubts/answerReview.ts` | Faculty moderation; accepting or un-accepting an answer | `answerReview.test.ts` (9) |
| `services/settings/posting.ts` | Allowed categories and subjects (was in a controller file, so services could not use it) | via the above |

`controllers/complaintErrors.ts` gives the three complaint controllers one way to report a refusal.
`admin/complaints.ts` went from 820 to about 400 lines and `faculty/complaints.ts` from 227 to about 100.

**Defects found by the extraction, and fixed:**

| Defect | Effect | Fix |
|---|---|---|
| `PUT /faculty/answers/:id/moderate` had five handlers chained, from an import list pasted into the route in CC-12's merge (`649cfe3`) | **Faculty could not moderate answers at all.** The AI-draft approval ran first and refused every request | One handler. New `regression/routeHandlers.test.ts` walks the live router and fails if any route runs more than one controller handler; it was verified to fail on the old routes. Two other routes had the same paste (harmless, since the first handler answered) and were cleaned |
| Confirm, reject and feedback checked the status, then wrote unconditionally | A double tap could escalate a complaint twice, or record feedback twice | Conditional writes; the loser gets 409 or 400 |
| Rejecting a previously approved answer kept the approval points | Reputation for a rejected answer | Revoked |
| Un-accepting an answer, or accepting another, kept the acceptance points | Reputation for an answer no longer accepted | Revoked from the previous author |
| Moving acceptance to another answer was several separate writes | A failure part-way could leave two answers accepted | One transaction |
| Priority on a new complaint was not validated | `"high"` or `7` reached the database and came back as a 500 | 400 with a message |
| Complaint text and student rejection reasons were written to the server log | Personal content in logs | Removed |

**Still inline:** read-only handlers (doubt listing and detail, dashboards, analytics) and profile
updates. They are queries rather than rules, so moving them buys less; `getDoubtById` (186 lines,
duplicated for faculty) is the best next candidate.

## Rollback

`git checkout` the four controller files and delete the three directories. Nothing else references
the new paths.
