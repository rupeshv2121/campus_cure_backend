# CampusCure — Engineering Docs

This folder is the source of truth for **what we are building and why**. Code follows specs, not the
other way round.

> **Location (moved 2026-09-20):** these docs live in `campus_cure_backend/docs/` and are tracked and
> pushed with the backend repo. They previously sat at the project root, untracked — ten specs and
> three ADRs existing only on one machine. Backend and frontend are still separate repos; the docs
> cover both and live here because this is the repo with a remote.

## Layout

```
docs/
├── README.md            you are here — the process
├── ROADMAP.md           every planned feature, sequenced, with branches
├── adr/                 architecture decision records (the "why", permanent)
│   └── NNNN-title.md
└── specs/               feature specs (the "what", one per branch)
    ├── TEMPLATE.md
    └── CC-NN-slug.md
```

## The process

Spec-driven development here means five steps, in order. **Do not skip step 1.**

### 1. Write the spec

Copy `specs/TEMPLATE.md` to `specs/CC-NN-slug.md`. Fill in every section. The two that matter most:

- **Acceptance criteria** — testable statements. If you can't write a test for it, it isn't a criterion.
- **Out of scope** — the section that stops a two-day feature becoming a two-week one.

A spec is done when someone else could implement it without asking you a question.

### 2. Review the spec

Read it back cold. Check: does it depend on something unbuilt? Does it change the DB? Does it touch
auth? Is there a rollback? Update the spec until the answer to "what could go wrong" is written down.

Set status to `Approved`.

### 3. Claim it

This is a shared repo and the roadmap has real dependencies, so before writing code:

- Set the spec's `Status` to `In progress` and add your name. **One owner per spec at a time.**
- Check the spec's `Depends on` — if a dependency isn't merged yet, you're blocked. Say so rather
  than working around it.
- Tell the team if you're about to generate a Prisma migration. Only one person at a time.

Use whatever branch you normally work on. The roadmap suggests branch names but the team has
deliberately **not** changed its branching model — see `ROADMAP.md` → Git strategy.

### 4. Implement against the acceptance criteria

Write the tests from the acceptance criteria first where practical. Do not add features the spec
doesn't list — if you find something missing, amend the spec in the same PR so the doc stays true.

### 5. Close the loop

Reference the spec ID in your commits (`CC-11: add rank fusion`) so `git log --grep=CC-11` answers
"what landed for this feature?" regardless of branch layout. On merge, set the spec status to
`Shipped` and add the merge date. If reality diverged from the spec, **fix the spec** — a stale spec
is worse than no spec.

## Spec statuses

| Status | Meaning |
|---|---|
| `Draft` | Being written. Not ready to build. |
| `Approved` | Reviewed. Safe to branch and build. |
| `In progress` | Branch exists, work underway. |
| `Shipped` | Merged to `develop`. |
| `Superseded` | Replaced — link the replacement. |
| `Cut` | Deliberately not building. Keep the file; the reasoning is the value. |

## ADRs vs specs

- **Spec** = one feature, one branch, finite lifespan. Answers *what* and *how*.
- **ADR** = one decision with long-term consequences. Answers *why*. Never deleted, only superseded.

Write an ADR when a choice would otherwise get re-litigated in three months: provider choices, data
model direction, auth model, anything with a migration cost.

## Conventions

- **Feature IDs** are `CC-NN`, allocated in `ROADMAP.md`. Never reuse a number.
- **Commits** reference the ID: `CC-11: add hybrid retrieval fusion`.
- **Migrations** are named for the feature: `npx prisma migrate dev --name cc10_add_doubt_embedding`.
- **Every AI provider call** goes behind an interface in `src/services/ai/`. No SDK calls in controllers.
- **Model IDs live in env vars**, never hardcoded — hosted model names churn without notice.
