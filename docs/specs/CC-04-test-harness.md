# CC-04: Test harness & CI

| | |
|---|---|
| **Status** | Approved |
| **Phase** | 0 |
| **Branch** | `feat/CC-04-test-harness` |
| **Repos** | backend |
| **Depends on** | CC-00 |
| **Blocks** | CC-02, CC-10, CC-61 |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

The backend is ~5,800 lines enforcing a four-role permission model (`STUDENT`, `FACULTY`, `ADMIN`,
`SUPER_ADMIN`) across five route modules, and has **no tests at all** — no test runner, no test
script, no CI.

Two consequences, both active right now:

1. **Nothing verifies the authorization model.** "Can a student reach an admin endpoint?" is
   answerable only by reading 5,800 lines by hand. That is exactly the bug class that ships silently
   and is discovered by a user.
2. **CC-01 just shipped security-critical changes with no regression tests.** Fail-fast config, three
   rate limiters, removal of password logging, and the user-enumeration fix were verified once, by
   hand. Nothing stops the next edit reintroducing any of them — the password `console.log` in
   particular is one careless debug line away from returning.

Every roadmap feature after this adds surface area to the permission model. The test matrix should
exist before the surface grows, not after.

## Goal

`npm test` runs a meaningful suite in seconds with no external setup, the four-role authorization
matrix is asserted rather than assumed, CC-01's guarantees are locked in by tests, and CI runs the
suite on every push.

## Non-goals / Out of scope

- High line-coverage targets. Coverage as a number is not the objective; the authorization matrix
  and the CC-01 regressions are.
- Frontend tests — separate concern, separate repo, not scheduled yet.
- Load or performance testing.
- E2E browser tests (Playwright/Cypress).
- Rewriting controllers for testability. Tests adapt to the current structure; the service refactor
  is CC-72.

## Design

### Runner: Vitest

Vitest over Jest: the project is ESM (`"type": "module"`) and TypeScript-native via `tsx`. Jest needs
meaningful configuration to handle both; Vitest handles them natively and runs faster.

Supertest drives HTTP assertions against the Express app without binding a port.

### Two tiers, so the suite is useful with zero setup

The hard constraint: there is **no test database**. The only database is production Supabase, and
tests must never touch it. Docker is installed locally but not always running, and CI has its own
services. So:

**Tier 1 — always runs. No database, no network, no secrets.**

- Pure unit tests: `config/env.ts` validation, rate-limiter key derivation, JWT helpers.
- Route-level **authorization matrix** with `prisma` mocked. This tests what we actually care about —
  which role reaches which route — without a database, because authorization is decided by
  middleware before any query runs.

**Tier 2 — opt-in. Skipped unless `TEST_DATABASE_URL` is set.**

- Real Prisma against a throwaway Postgres (Docker `pgvector/pgvector:pg17`, matching production's
  PostgreSQL 17.6 and giving CC-10 a place to rehearse its migration).
- Guarded so the suite stays green for a developer who has not started Docker.

A **safety assertion in global setup** aborts the entire run if `TEST_DATABASE_URL` is unset while
`DATABASE_URL` points at anything containing `supabase.com`, so a misconfigured run can never write
to production.

### The authorization matrix

The centrepiece. A table-driven test over representative routes from each module:

| Route family | STUDENT | FACULTY | ADMIN | SUPER_ADMIN | anonymous |
|---|---|---|---|---|---|
| `/api/students/*` | allow | deny | deny | deny | 401 |
| `/api/faculty/*` | deny | allow | deny | deny | 401 |
| `/api/admin/*` | deny | deny | allow | allow | 401 |
| super-admin-only routes | deny | deny | deny | allow | 401 |
| `/api/notifications/*` | allow | allow | allow | allow | 401 |

Each cell asserts a status: `401` unauthenticated, `403` wrong role, **not-403** for permitted roles
(the handler may still 400/404 against a mocked database — the assertion is about the authorization
decision, not the handler's business logic).

The exact route list is derived from the route modules during implementation and recorded here.

### CC-01 regression tests

Explicitly locking in what CC-01 fixed, because these are the ones that silently regress:

1. `env.ts` rejects missing / short (<32) / known-default secrets, and accepts a valid one.
2. Login returns an identical body for an unknown email and a wrong password (no enumeration).
3. **No handler logs `req.body` on the auth path.** Implemented as a spy on `console.log` during a
   login request, asserting no emitted argument contains the submitted password. This is the guard
   that stops the plaintext-password leak returning.
4. Security headers present on a response.
5. Rate limiters trip at the configured threshold and key per account, not just per IP.

### Layout

```
src/
└── __tests__/
    ├── setup.ts                    global setup + production-DB safety assertion
    ├── helpers/
    │   ├── auth.ts                 sign tokens for each role
    │   └── prismaMock.ts           mock factory for the Prisma client
    ├── unit/
    │   ├── env.test.ts
    │   └── rateLimit.test.ts
    ├── authz/
    │   └── matrix.test.ts
    └── integration/                Tier 2, skipped without TEST_DATABASE_URL
```

Scripts: `npm test` (run once), `npm run test:watch`, `npm run test:coverage`.

### CI — GitHub Actions

`.github/workflows/test.yml` on push and PR: install, `prisma generate`, typecheck, Tier 1 tests.

**Audit policy** (per [ADR-0003](../adr/0003-stay-on-prisma-7.md)): CI must **not** fail on the four
known Prisma-CLI advisories — a permanently red build trains everyone to ignore it. It **must** fail
on any new advisory in a *runtime* dependency. Implemented as
`npm audit --omit=dev --audit-level=high`, which scopes the check to shipped dependencies and so
naturally excludes the CLI findings.

## Acceptance criteria

1. `npm test` passes from a clean clone with no `.env`, no database, and no network.
2. The suite completes in under 30 seconds.
3. The authorization matrix covers all four roles plus anonymous across all five route modules.
4. A student token against an admin route asserts `403`; no token asserts `401`.
5. `env.ts`: missing, 10-char, 31-char and known-default secrets each fail; a 32-char secret passes.
6. Login returns byte-identical responses for unknown-email and wrong-password.
7. A test fails if any auth-path handler passes `req.body` to `console.log`.
8. Security headers are asserted present.
9. Rate limiter tests assert the 6th failed login is `429` and that a different account is unaffected.
10. Tier 2 integration tests **skip cleanly** when `TEST_DATABASE_URL` is unset — reported as skipped,
    not failed.
11. The run aborts immediately if `DATABASE_URL` looks like production and `TEST_DATABASE_URL` is
    unset.
12. CI runs on push and passes.
13. CI fails on a new high-severity advisory in a runtime dependency, and does not fail on the four
    known Prisma CLI advisories.

## Test plan

Self-referential by nature. Verification is: the suite passes; then deliberately break each guarantee
(reintroduce `console.log(req.body)`, shorten the secret check, remove a role guard) and confirm the
corresponding test goes red. **A test suite that has never failed has not been tested.**

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A test accidentally writes to the production database | Low | **Critical** | Global setup aborts when `DATABASE_URL` looks like Supabase and no `TEST_DATABASE_URL` is set; Tier 1 mocks Prisma entirely |
| Mocked Prisma diverges from real behaviour | Medium | Medium | Mocks assert authorization, never business logic; Tier 2 covers real queries |
| Suite becomes slow and gets skipped | Low | Medium | Tier 1 has no I/O; 30s budget is a criterion |
| Brittle tests coupled to response text | Medium | Low | Assert status codes and shape, not copy — except the enumeration test, where identical text *is* the requirement |

## Rollback

Purely additive — a new dev dependency, a new test directory, a CI file. Nothing in `src/` changes
behaviour. Delete the directory and the workflow to revert.

## Open questions

- Should CI also run Tier 2 against a Postgres service container? Preferable, and cheap on GitHub
  Actions. Deferred until CC-10 actually needs migration testing, to keep this branch small.
