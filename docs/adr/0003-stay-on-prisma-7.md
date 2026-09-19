# ADR-0003: Stay on Prisma 7 despite npm audit advisories

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-09-19 |
| **Supersedes** | — |

## Context

While implementing CC-01, `npm audit` reported 22 vulnerabilities (14 high) in the backend. A
non-breaking `npm audit fix` cleared most, leaving **5 (4 high)**. Every remaining high traces to the
`prisma` CLI, and npm proposes a single remedy:

```
fixAvailable: { name: "prisma", version: "6.19.3", isSemVerMajor: true }
```

That is a **major version downgrade** from Prisma 7. This ADR records why we declined it.

## The remaining advisories

| Package | Advisory | CVSS | Reached via |
|---|---|---|---|
| `mysql2@3.15.3` | Auth plugin downgrade leaks plaintext credentials (`<3.22.0`) | unscored | `prisma` CLI |
| `mysql2@3.15.3` | Unbounded zlib inflate — decompression-bomb DoS (`<=3.23.0`) | 5.9 | `prisma` CLI |
| `deepmerge-ts@7.1.5` | Stack exhaustion merging recursive object graphs (`<8.0.0`) | unscored | `prisma` → `@prisma/config` |
| `@prisma/config` / `prisma` | Flagged transitively by the two above | — | — |
| `esbuild@0.27.3` | Arbitrary file read via **dev server** on Windows (`>=0.27.3 <0.28.1`) | 2.5 (low) | `tsx` |

## Decision

**Stay on Prisma 7**, aligned at `7.10.0` across CLI, client, and adapter. Do not downgrade.

## Rationale

### 1. The proposed fix does not actually fix it

Verified directly against the registry:

```
@prisma/config@6.19.3 → deepmerge-ts 7.1.5   ← same vulnerable version
@prisma/config@7.10.0 → deepmerge-ts 7.1.5
```

Prisma 6.19.3 pins the **exact same vulnerable `deepmerge-ts`**. Downgrading would not resolve that
advisory at all. It removes only the `mysql2` findings, and only because the Prisma 6 CLI doesn't
bundle database drivers:

```
prisma@6.19.3 deps: @prisma/config, @prisma/engines
prisma@7.10.0 deps: @prisma/config, @prisma/engines, mysql2, postgres,
                    @prisma/dev, @prisma/studio-core
```

So Prisma 7's higher advisory count reflects a **larger bundled surface** (drivers + Studio shipped
in the CLI), not a less secure ORM. We would pay a major migration to half-fix the report.

### 2. None of it is reachable in our usage

- **`mysql2`** — we use PostgreSQL. The mysql2 code path is never invoked. Both advisories require
  parsing a response from a malicious or compromised **MySQL server**, which we never connect to.
- **`deepmerge-ts`** — used by `@prisma/config` to merge our own `prisma.config.ts`. Triggering it
  needs attacker-controlled config, which implies repository write access; at that point the
  advisory is the least of the problems.
- **`esbuild`** — the vulnerability is in esbuild's **dev server**. It arrives via `tsx`, which uses
  esbuild's transform API and never starts that server. Worth noting only because the team develops
  on Windows, which is the affected platform.

### 3. None of it ships to production

`prisma` is a `devDependency`. The deployed Vercel lambda resolves `@prisma/client`, whose complete
runtime dependency set is:

```json
{ "@prisma/client-runtime-utils": "7.10.0" }
```

No `mysql2`, no `@prisma/config`, no `esbuild`. Nothing under `src/` or `api/` imports any flagged
package. These are build-time tooling advisories on a developer machine, not production exposure.

### 4. A downgrade would break working code

Our setup uses Prisma 7 APIs that Prisma 6 does not support as-is:

- `prisma.config.ts` calls `defineConfig` from `prisma/config` and supplies `datasource.url`.
- `prisma/schema.prisma` declares `datasource db { provider = "postgresql" }` with **no `url`** —
  valid only because the config file provides it. Prisma 6 requires `url` in the schema block.
- Driver adapters (`@prisma/adapter-pg` + `new PrismaClient({ adapter })`) are GA in 7; in 6 they
  require `previewFeatures = ["driverAdapters"]`.

A downgrade therefore means rewriting the datasource, reworking or removing `prisma.config.ts`,
adding a preview-feature flag, downgrading three packages, regenerating the client, and re-verifying
22 migrations against production data — to fix one unreachable advisory while keeping another.

### Why npm suggests the downgrade

The `latest` dist-tag for `prisma` currently points at `8.0.0-rc.15`, a **prerelease**. The audit
resolver won't recommend a prerelease, and no patched 7.x exists (the advisory range spans
`6.13.0-dev.1 – 8.1.0-dev.6`), so it walks back to the newest version whose tree it can resolve
clean — Prisma 6. It's a resolver artifact, not a security judgement.

## Consequences

**Good**

- No migration risk, no schema rewrite, no downtime.
- We stay on the newest stable Prisma 7, with driver adapters and `prisma.config.ts` intact.

**Bad / accepted**

- `npm audit` will keep reporting 4 highs. **This is the real cost:** a permanently noisy audit
  trains people to ignore it, and a genuine advisory could hide in the noise. Mitigation: CC-04's CI
  must not fail the build on these, but *must* fail on any **new** advisory in a runtime dependency.
  Re-read this ADR whenever the audit output changes rather than assuming it's the same four.
- If we ever add MySQL, the `mysql2` analysis is void and must be redone. We won't — we're on
  Supabase Postgres ([ADR-0002](0002-vector-storage.md)).

## Follow-up

- **Prisma 8** drops `mysql2` entirely and restructures the CLI (`@prisma/cli-engine`,
  `@prisma/orm-toolchain`). Upgrade once it reaches stable — that's the real fix. It is a major
  version, so it gets its own spec and its own testing pass; do not take it mid-phase.
- Revisit if `deepmerge-ts@8` is backported into a Prisma 7 patch.

## Change applied alongside this decision

`npm audit fix` had silently bumped the CLI from `7.3.0` to `7.10.0` (inside the `^7.3.0` range)
while `@prisma/client` and `@prisma/adapter-pg` stayed at `7.3.0`. Prisma requires CLI and client in
lockstep, so this skew was corrected by aligning all three at `^7.10.0`.

Verified after alignment: `prisma generate` succeeds (v7.10.0), `tsc --noEmit` clean,
`prisma migrate status` reports 22 migrations and "Database schema is up to date", and a live query
against Supabase returns successfully. No schema change, no migration, no functional difference.
