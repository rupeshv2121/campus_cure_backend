# CC-21: Doubt bookmarks

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration NOT applied; pending review/merge |
| **Phase** | 2 |
| **Branch** | `feat/CC-21-bookmarks` |
| **Repos** | both |
| **Depends on** | none |
| **Blocks** | nothing |
| **Estimate** | 1 day |
| **Shipped** | — |

## Problem

A doubt a student wants to come back to has no home. The only lists that exist are "all doubts"
(`getDoubts`, `studentController.ts:723`) and "my doubts" (`getMyDoubts`), and neither covers the
common case: *someone else's* doubt that is useful to me — the one with the good explanation of
normalization I will want the night before the exam.

Today the workarounds are upvoting it, which is a public signal and not a private list, or keeping
the tab open. Upvote is already doing double duty here: `DoubtUpvote` (`prisma/schema.prisma:176`)
records a quality judgement, and reusing it as "save for later" corrupts a number that CC-25
(reputation) is going to read.

## Goal

A student or faculty member can privately save any doubt and find their saved doubts on one page. The
saved list is private, has no effect on any public count, and never appears to the author of the
doubt.

## Non-goals / Out of scope

- **Bookmarking answers or complaints.** Doubts only. An answer is reachable from its doubt.
- **Folders, collections, or notes on a bookmark.** A flat list. Folders are a feature for people who
  have hundreds of bookmarks, which nobody here does yet.
- **Sharing or public bookmark lists.** Private is the whole point — see Risks.
- **A bookmark count on the doubt.** Displaying "23 people saved this" makes a private action public
  and changes behaviour. Explicitly rejected, not forgotten.
- **Notifications when a bookmarked doubt gets an answer.** Genuinely useful, genuinely a different
  feature — it needs the CC-40/41 notification channels. Revisit after those ship.
- **Bookmark-driven reordering of the main feed.**

## Design

### Schema

`DoubtBookmark` mirrors `DoubtUpvote` (`prisma/schema.prisma:176`) exactly. Same shape, same
composite unique, same cascade behaviour, same index pair. Following an existing model that is known
to work beats inventing a second convention for the same relationship.

```prisma
model DoubtBookmark {
  id       String   @id @default(uuid())
  doubtId  String
  userId   String
  savedAt  DateTime @default(now())
  doubt    Doubt    @relation(fields: [doubtId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([doubtId, userId])
  @@index([userId])
  @@index([doubtId])
}
```

Plus the two back-relations on `Doubt` and `User`.

Migration: `npx prisma migrate dev --name cc21_add_doubt_bookmark`.

There is deliberately **no** denormalized `bookmarkCount` on `Doubt`, unlike `upVoteCount`. A counter
exists to be displayed, and this one must not be.

`onDelete: Cascade` on both sides means a deleted doubt takes its bookmarks with it, which is correct
— a bookmark to nothing is not worth preserving.

### Endpoints

All under `/api/students`, authorized for `STUDENT` and `FACULTY` — matching `upvoteDoubt`
(`src/routes/students.ts:141`), which already grants both roles.

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/doubts/:doubtId/bookmark` | Idempotent save. Already saved → 200, not 409. |
| `DELETE` | `/doubts/:doubtId/bookmark` | Idempotent remove. Not saved → 200. |
| `GET` | `/doubts/bookmarked` | The caller's saved doubts, newest save first. |

Idempotency on both writes is a deliberate choice: this is a toggle driven by a button that students
will double-tap on bad campus wifi, and an error on the second tap is noise, not information. The
composite unique makes the database enforce it regardless.

**Route ordering:** `/doubts/bookmarked` must be registered before `/doubts/:id`
(`src/routes/students.ts:113`) or `bookmarked` is parsed as a doubt id. The same hazard is already
documented at `students.ts:70` for `/complaints/similar`.

### Read path

`getDoubts` and `getDoubtById` gain `isBookmarkedByUser: boolean`, computed exactly the way
`isUpvotedByUser` already is — one batched `findMany` over the returned ids, not N queries.
`getDoubts` already does this for upvotes at `studentController.ts:787`; the bookmark lookup goes
alongside it, in the same pass.

`GET /doubts/bookmarked` reuses the same `include` shape as `getDoubts` so the frontend can render
saved doubts with the existing card component and no second type.

### Frontend

- A bookmark icon button on each doubt card (`DoubtCommunity.tsx:456` area) and on the detail header
  (`DoubtDetail.tsx`), filled when saved.
- Optimistic toggle via TanStack Query `onMutate`, rolled back on error. The button never waits for
  the network — this is the whole reason the endpoint is idempotent.
- New page `src/pages/student/SavedDoubts.tsx`, routed at `/student/doubts/saved` in `App.tsx`
  alongside the existing student routes at lines 53–58, lazy-loaded like its neighbours.
- Empty state that says what a bookmark is for, since nothing else in the UI explains it.

Note the route collision: `/student/doubts/saved` sits under `/student/doubts/:id` in the client
router too. React Router matches the more specific static segment first, so this works — but it is
worth an explicit test, because it is the exact mistake the backend route ordering also guards
against.

## Acceptance criteria

1. A student can bookmark another student's doubt and it appears in `GET /doubts/bookmarked`.
2. Bookmarking twice returns 200 both times and creates exactly one row.
3. Removing a bookmark that does not exist returns 200.
4. `GET /doubts/bookmarked` returns only the caller's bookmarks, never another user's.
5. Faculty can bookmark, matching the roles granted on `upvoteDoubt`.
6. `getDoubts` and `getDoubtById` return an accurate `isBookmarkedByUser` for the caller.
7. Bookmarking does not change `upVoteCount` or any other public counter.
8. No bookmark count is exposed on any doubt response.
9. Deleting a doubt removes its bookmark rows.
10. `/doubts/bookmarked` resolves to the list, not to `getDoubtById("bookmarked")`.
11. `/student/doubts/saved` in the browser renders the saved page, not the detail page.
12. A failed toggle rolls the optimistic UI back.

## Implementation notes 2026-09-21

Built. 16 route tests in `src/__tests__/unit/bookmarks.test.ts`, plus four rows in the
authz matrix.

**The migration has not been run.** `prisma/migrations/20260921120000_cc21_add_doubt_bookmark`
creates the table but has not been applied anywhere.

Because of that, the read paths tolerate the table being absent: `readBookmarkedIds`
returns an empty set on the missing-table error rather than throwing, so the doubt feed
and detail page keep working with every doubt simply showing as unsaved. This mirrors
the tolerance the existing upvote read already has for the same reason. The *write*
paths do not pretend — saving a doubt before the migration runs will error, which is
correct: silently discarding a save is worse than failing.

Criterion 9 (deleting a doubt removes its bookmarks) is enforced by `ON DELETE CASCADE`
in the migration and is not covered by a test — the mocked Prisma client cannot
demonstrate a database-level cascade. It needs the Tier 2 harness or a manual check.

## Test plan

- **Unit:** the toggle service — save, save-again, remove, remove-absent.
- **Integration:** all three endpoints across all four roles, added to
  `src/__tests__/authz/matrix.test.ts`. Explicit isolation test: user A's bookmarks never appear for
  user B. Explicit route-shadowing test for criterion 10.
- **Manual:** bookmark on a throttled connection, double-tap the button, confirm one row and no error
  toast.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bookmark treated as a public signal later | Medium | Medium | No counter column exists to display; adding one is a visible migration, not an accident |
| Bookmarks leak across users | Low | High | Every query is scoped by `req.user.id`; explicit isolation test |
| Route shadowing breaks doubt detail | Medium | Medium | Ordering enforced in `students.ts`, covered by criterion 10 |
| Optimistic toggle desyncs from server | Low | Low | Rollback on error, invalidate on settle |

## Rollback

Revert both repos and drop the table. The migration is additive and nothing else references
`DoubtBookmark`, so the drop is clean. Users lose their saved lists, which is an acceptable loss for
a feature being withdrawn — but say so before doing it rather than after.

## Open questions

1. Should admins be able to bookmark? They do not use the doubt community today. Excluded for now;
   trivial to add.
2. Is `/student/doubts/saved` the right URL, or should it be `/student/saved`? The former groups it
   with doubts, the latter leaves room for saving other things later. Leaning on the former until
   there is something else to save.
