# CC-72: Controller split (stage 1 of the service refactor)

| | |
|---|---|
| **Status** | **Stage 1 done** 2026-10-04: controllers split by area, behaviour unchanged. Stage 2 (logic into services) not started |
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

## Stage 2 (not done)

Move business logic out of the handlers into `services/<area>/` so it can be tested without HTTP,
one area at a time, each with its own tests first. The obvious first candidates are complaint
assignment (`admin/complaints.ts`), which mixes routing, SLA, history JSON and notifications in one
handler, and the doubt listing query in `student/doubts.ts`.

## Rollback

`git checkout` the four controller files and delete the three directories. Nothing else references
the new paths.
