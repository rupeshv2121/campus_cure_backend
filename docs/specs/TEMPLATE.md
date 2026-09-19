# CC-NN: <Feature name>

| | |
|---|---|
| **Status** | Draft |
| **Phase** | <0-7> |
| **Branch** | `feat/CC-NN-slug` |
| **Repos** | backend / frontend / both |
| **Depends on** | CC-XX, CC-YY (or "none") |
| **Blocks** | CC-ZZ (or "nothing") |
| **Estimate** | <N> days |
| **Shipped** | — |

## Problem

What is broken or missing today. Reference the actual code: `path/to/file.ts:line`.
Be concrete about who feels the pain and when. No solutions in this section.

## Goal

One paragraph. What is true after this ships that isn't true now.

## Non-goals / Out of scope

Explicit list of things a reader might reasonably assume are included, but aren't.
This section prevents scope creep — write it before you write the design.

## Design

How it works. Include:

- Data model changes (Prisma schema diffs, migration name)
- New endpoints — method, path, auth/role, request shape, response shape
- New modules/files and where they live
- Frontend components and which pages change
- Third-party services and which env vars they need

Diagrams welcome where flow is non-obvious.

## Acceptance criteria

Numbered, testable. Each one should map to a test or a manual verification step.

1. ...
2. ...

## Test plan

- **Unit:** what gets unit tested
- **Integration:** which endpoints, which roles
- **Manual:** what a human checks before merge

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| | | | |

## Rollback

How to undo this if it goes wrong in production. Note irreversible steps (destructive migrations,
data deletion, external state) explicitly — those need a backup taken first.

## Open questions

Anything unresolved. A spec with open questions blocking the design is still `Draft`.
