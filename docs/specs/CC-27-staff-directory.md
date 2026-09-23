# CC-27: Staff directory & routable non-teaching staff

| | |
|---|---|
| **Status** | **Implemented** 2026-09-23 — code complete and tested; migration pending a database |
| **Phase** | 2 |
| **Branch** | `feat/CC-27-staff-directory` |
| **Repos** | both |
| **Depends on** | CC-14 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

The rules table deleted before CC-14 mapped complaint categories to *teaching faculty by
department*, so a broken fan was routed to a lecturer in Electrical Engineering. **Fans are fixed by
electricians.** CC-14 replaced the routing table but not the underlying problem: non-teaching staff
did not exist as first-class targets, so CC-14 could classify a complaint perfectly and still hand
it to the wrong kind of person.

Reading the code turned up the sharper version of this:

> **`FacultyProfile.isTeaching` already existed, was settable through the profile API, and was read
> by nothing.** `getApprovedFaculty` returned *every* approved faculty member, ordered by name, with
> `isTeaching` not even in the `select`. An admin assigning "broken fan in ML02" saw a flat list of
> eighty lecturers with no way to tell which one was the electrician.

The field that would have prevented the bug was already in the database. It was never consulted.

There is also a legitimate need the roadmap explicitly kept alive when it cut the student directory:
people need to reach staff. That was cut as a harassment vector over minors' phone numbers,
addresses and guardian details — data those students never offered for that purpose. Staff contact
details are different in one specific way, and this spec is built on it: **consent**.

## Goal

Non-teaching staff are first-class routing targets. Assignment ranks candidates by who actually
handles the kind of fault reported. Anyone at the institution can look up staff who chose to be
listed.

## Non-goals / Out of scope

- **Auto-assignment.** This ranks; a human decides. See below.
- **A student directory.** Cut by the roadmap and still cut.
- **Shift, leave or roster modelling.** Open complaint count is the only workload signal.
- **A separate `StaffProfile` model.** See below.
- **Renaming `FacultyProfile`.** It now backs teaching and non-teaching staff alike, so the name is
  slightly wrong. Renaming a model whose table holds live rows, mid-project, for accuracy alone, is
  the worse trade — the same call already recorded on `EmailOutbox`.

## Design

### It ranks; it never auto-assigns

Auto-assignment would have to be right about workload, leave, shift and competence. It is not right
about any of those, and a wrong auto-assignment is worse than no assignment because it *looks*
handled. What the system can do is stop an electrician being invisible in a list of eighty
lecturers.

Same posture as CC-14 and CC-50: suggest, never decide. Consistent, and for the same reason.

### `handlesCategories` is the routing field; `staffRole` is not

Two new fields that look similar and are not:

| Field | Type | Used for |
|---|---|---|
| `staffRole` | free text | **Display only.** "Electrician", "Lab Assistant" |
| `handlesCategories` | CC-14 category names | **Routing.** Validated on write |

`staffRole` is free text because a college's job titles are not ours to enumerate and an unknown
title must not be unrepresentable. Precisely *because* it is unconstrained, routing never reads it —
matching on free text would mean "Electrician", "electrician" and "Elec." are three different
trades.

`handlesCategories` uses CC-14's own category vocabulary, and the backend rejects any value outside
it. An unrecognised category there would be a silent dead end: it would match no complaint and
explain nothing.

Empty is the correct default for a lecturer — absence of a claim, not a claim of absence.

### The ranking

| Band | Score | Meaning |
|---|---|---|
| `handles-category-same-department` | 100 | Declared it, and is nearby |
| `handles-category` | 80 | Declared it |
| `non-teaching-general` | 40 | Support staff, no declaration |
| `teaching-fallback` | 10 | A lecturer |

Then open complaint count, then name.

Two properties are load-bearing:

- **Department is a tiebreak, never a qualification.** An electrician from another department fixes
  fans better than a nearby lecturer does. Treating department as a qualification is the exact
  mistake the deleted rules table made.
- **Load applies only *within* a band.** If load could cross bands, an idle lecturer would outrank a
  busy electrician — and we would be back to the original bug by a different route. There is a test
  for this.

Undeclared non-teaching staff outrank lecturers because they are maintenance staff of some kind and
the declaration may simply be incomplete.

### The candidate list is never filtered

Everyone assignable comes back, best first. A wrong `handlesCategories` value must not make a
complaint unassignable, and the admin must always be able to overrule the ranking — so the UI shows
the *reason* next to each name, not just the order. An admin who cannot see why someone is first has
no basis to disagree.

### Consent is the whole justification for the directory

`directoryOptIn` defaults to **false**, and only the subject can set it — there is no admin route
that opts someone in. That is the entire difference between this and the student people-finder the
roadmap cut.

A profile that has not opted in is **absent** from the directory, not listed with details redacted.
Listing someone as "contact hidden" still confirms they work here and in which department, which is
more than they agreed to.

`address` is never selected, let alone returned. It is on the profile for administrative use and has
no place in a directory every student can read. `phoneNumber` returns `null` rather than the string
`"Not Set"` that registration writes — otherwise students would be dialling a placeholder.

The directory requires authentication. Unauthenticated it would be a scraper's list of one
institution's staff names, roles and phone numbers.

### Schema

Four additive columns on `FacultyProfile`, plus a GIN index — every routing query is a containment
test ("who handles FAN?") over an array column, which a btree cannot answer.

Migration: `20260923140000_cc27_staff_directory`.

### Endpoints

| Endpoint | Roles | Purpose |
|---|---|---|
| `GET /api/staff/directory` | all authenticated | Opted-in staff, filterable |
| `GET /api/admin/complaints/:id/candidates` | admin, super admin | Ranked candidates |
| `PUT /api/faculty/me` (extended) | faculty | Declare role, categories, consent |

The directory lives on its own router rather than under `/api/faculty`. Mounted there, someone would
eventually put an `authorize(Role.FACULTY)` next to it and quietly break the feature for the
students it exists to serve.

## Acceptance criteria

All 12 covered by automated tests (32 assertions in `staffRouting.test.ts`, plus two authz matrix
rows).

1. An electrician who declares `FAN` outranks an Electrical Engineering lecturer.
2. …even when the electrician is busier and alphabetically last.
3. Undeclared support staff outrank lecturers.
4. Same-department declaring staff outrank other-department declaring staff.
5. Open load reorders *within* a band and never across one.
6. Every assignable person is returned; nothing is filtered out.
7. An unknown or missing category ranks on role alone rather than returning nothing.
8. Load is one grouped query regardless of candidate count.
9. The directory returns only opted-in profiles.
10. The directory never returns or selects `address`.
11. `"Not Set"` phone numbers come back as `null`.
12. `handlesCategories` rejects values outside CC-14's vocabulary with a 400 naming them.

## Test plan

- **Unit:** the full ranking matrix with a mocked Prisma, including the band/load interaction and
  the fan-versus-lecturer case that names the original bug. Directory consent, field projection and
  filter construction.
- **Integration:** two rows in `src/__tests__/authz/matrix.test.ts`.
- **Manual (needs a database):** opt a profile in, confirm it appears; opt out, confirm it
  disappears rather than greying out. Assign a `FAN` complaint and confirm the electrician is first.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nobody fills in `handlesCategories`, ranking degrades to teaching/non-teaching | **High** | Medium | Still strictly better than name order; the profile field explains what it does |
| Staff opt into the directory without understanding the reach | Medium | Medium | The toggle states exactly what is shared and that address never is |
| `staffRole` free text becomes a de-facto routing field | Medium | Low | Routing reads only `handlesCategories`; recorded here and in the code |
| Ranking treated as authoritative and rubber-stamped | Medium | Medium | Reason shown per candidate; list never filtered |
| Load count grows expensive | Low | Low | One grouped query, indexed on `assignedToId` |

## Rollback

The migration is additive and defaulted. Revert the code and assignment falls back to
`getApprovedFaculty`; the columns are harmless if left. The frontend already falls back to the flat
list when the candidates request fails, so a backend rollback alone does not break the screen.

## Open questions

1. Should a complaint with no declared handler warn the admin, rather than silently ranking
   lecturers first?
2. Should `handlesCategories` be settable by an admin for staff who never log in? Today it is
   self-service only, which is right for consent but may be wrong for a caretaker who does not use
   the app.
3. Departmental aggregates in the directory ("3 electricians in Maintenance") — useful, or a
   staffing-levels disclosure nobody asked to publish?
