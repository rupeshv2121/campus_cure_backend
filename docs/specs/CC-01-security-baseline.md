# CC-01: Security baseline

| | |
|---|---|
| **Status** | Partially shipped — see Delivery log |
| **Phase** | 0 |
| **Branch** | `feat/CC-01-security-baseline` |
| **Repos** | backend (+ small frontend change for token refresh) |
| **Depends on** | CC-00 |
| **Blocks** | CC-02, CC-10, CC-14, CC-15, CC-60, CC-62 |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

Five concrete issues in the current code. The first is exploitable today.

### 1. Hardcoded JWT secret fallback — critical

`src/config/database.ts:58-59`:

```ts
export const JWT_SECRET =
  process.env.JWT_SECRET ?? "your-secret-key-change-in-production";
```

If `JWT_SECRET` is unset in **any** environment, the application silently signs tokens with a string
that is committed to the repository. Anyone with read access to the source can forge a token for any
user — including `SUPER_ADMIN` — and the application will accept it. There is no startup warning and
no runtime symptom. A missing environment variable in a Vercel preview deployment is a full
authentication bypass.

This must fail loudly at boot instead.

### 2. No rate limiting anywhere

`src/app.ts` mounts `cors` and `express.json()` and nothing else. `POST /api/auth/login` accepts
unlimited attempts, so password brute force and credential stuffing are unimpeded. Once Phase 1 adds
LLM-backed endpoints, the same gap becomes a cost-amplification attack against metered third-party
APIs.

### 3. Tokens cannot be revoked

`authController.ts:253` and `:484` sign 7-day tokens with no refresh mechanism and no denylist. A
leaked token stays valid for a week. Logout is client-side only.

`middleware/auth.ts:29` partly compensates by loading the user on every request and rejecting
`!user.isActive` — so deactivation does take effect — but that costs a database round trip on
**every authenticated request**, which on serverless is latency on the critical path.

### 4. No security headers

No `helmet`. Missing HSTS, `X-Content-Type-Options`, frame options, referrer policy.

### 5. Unauthenticated face-login endpoint

`POST /api/auth/face-login` accepts a raw descriptor and returns a session with no rate limit,
allowing offline-style search against the biometric matcher. Full hardening is CC-60; this spec
covers rate limiting that endpoint only.

## Goal

The backend fails to start rather than run insecurely, authentication endpoints are rate limited,
sessions can be revoked, and standard security headers are present — before any AI endpoint or file
upload increases the attack surface.

## Non-goals / Out of scope

- Face-login liveness detection and biometric encryption — **CC-60**
- TOTP / 2FA — **CC-62**
- Audit logging — **CC-61**
- The role authorization test matrix — **CC-04** (this spec adds the mechanism, CC-04 proves it)
- CSRF protection — not applicable; auth is `Authorization: Bearer`, not cookies. Revisit if CC-62
  introduces cookie sessions.
- Password policy changes and bcrypt cost tuning. Cost 10 (`authController.ts:46`) is acceptable.

## Design

### 1. Fail-fast configuration

New `src/config/env.ts`, validating at module load — before the server accepts a request:

```ts
const required = ["DATABASE_URL", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`FATAL: ${key} is not set. Refusing to start.`);
  }
}

if (process.env.JWT_SECRET!.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be at least 32 characters.");
}
```

`database.ts` imports from here and the `??` fallback is deleted. Rotating the secret invalidates all
existing tokens — expected, and acceptable given the current secret may be the committed default.

> Deployment step: confirm `JWT_SECRET` is set in Vercel for **all three** environments (production,
> preview, development) before merging, or preview deployments will fail to boot.

### 2. Rate limiting

`express-rate-limit`, with `app.set("trust proxy", 1)` so Vercel's `X-Forwarded-For` is respected —
without this every request appears to originate from one address and the limiter blocks everyone.

| Scope | Limit | Key |
|---|---|---|
| `POST /api/auth/login`, `/face-login`, `/register` | 5 / 15 min | IP + submitted userID |
| All `/api/*` | 100 / min | user ID if authenticated, else IP |
| AI endpoints (reserved for Phase 1) | 20 / hour | user ID |

Default store is in-memory. On serverless each lambda instance has its own counter, so the effective
limit is per-instance — **weaker than it looks, but a large improvement over none**. Documented here
so it isn't mistaken for a hard guarantee; a shared Postgres or Redis store is a follow-up if abuse
is observed.

Failed login attempts are counted per-account as well as per-IP, so distributed attempts against one
account are still caught.

### 3. Refresh tokens and revocation

Access token lifetime drops from 7 days to **15 minutes**. A new refresh token, 7 days, is stored
server-side so it can be revoked.

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique   // SHA-256 of the token, never the token itself
  expiresAt DateTime
  revokedAt DateTime?
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

Migration: `cc01_add_refresh_token`.

- `POST /api/auth/refresh` — exchanges a valid refresh token for a new access token and **rotates**
  the refresh token.
- `POST /api/auth/logout` — revokes the presented refresh token.
- Reuse of an already-rotated token revokes **every** token for that user. That is the standard
  detection signal for a stolen refresh token.
- A Vercel cron job deletes expired rows daily.

Frontend: an axios response interceptor in `src/api/` catches `401`, calls `/refresh` once, retries
the original request, and redirects to login if refresh fails. Concurrent 401s must share a single
refresh promise, or a page issuing six parallel requests fires six refreshes and five of them fail
against rotation.

### 4. Helmet

```ts
app.use(helmet());
```

Mounted before routes. `crossOriginResourcePolicy` needs review against CC-02 once files are served
from Supabase Storage.

### 5. Keep the DB lookup in `authenticate`

Deliberately retained. It is what makes deactivation immediate, and correctness beats the saved round
trip. Revisit only if measurements show it matters.

## Acceptance criteria

1. Starting the backend without `JWT_SECRET` exits with a fatal error; the server does not listen.
2. Starting with a `JWT_SECRET` shorter than 32 characters exits with a fatal error.
3. The string `your-secret-key-change-in-production` appears nowhere in the repository **except**
   the `BANNED_SECRETS` list in `src/config/env.ts`, whose purpose is to reject it even if someone
   sets it deliberately via the environment.
4. A 6th login attempt within 15 minutes from one IP returns `429`.
5. A 6th failed login against one account from *different* IPs returns `429`.
6. Access tokens expire in 15 minutes; an expired access token returns `401`.
7. `POST /api/auth/refresh` with a valid refresh token returns a new access token **and** a new
   refresh token; the old refresh token is then rejected.
8. Presenting a rotated refresh token revokes all of that user's refresh tokens.
9. `POST /api/auth/logout` makes the refresh token unusable.
10. Responses carry `X-Content-Type-Options`, `Strict-Transport-Security`, and `X-Frame-Options`.
11. The frontend transparently refreshes an expired access token with no visible interruption, and
    six concurrent requests trigger exactly one refresh call.
12. Existing login, face-login, and every role's dashboard still work end to end.

## Test plan

- **Unit:** `env.ts` validation (missing key, short key, valid key); refresh token hashing and
  rotation logic.
- **Integration (Supertest):** login rate limit by IP and by account; refresh rotation happy path;
  rotated-token reuse revoking the family; logout; expired access token rejection; helmet headers.
- **Manual:** log in on the deployed frontend, wait past 15 minutes, confirm the session continues
  without a re-login prompt. Deactivate a user in another tab and confirm their next request 401s.
- **Manual:** deploy a Vercel preview with `JWT_SECRET` unset and confirm it fails to boot rather
  than serving with the default.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Secret rotation logs out all users | Certain | Low | Intended; announce before deploying |
| Rate limiter blocks a whole campus behind one NAT IP | Medium | High | `trust proxy` configured; key authenticated traffic by user ID, not IP; limits tuned generously |
| Refresh interceptor loops infinitely on 401 | Medium | High | Never retry the refresh call itself; single-flight promise; hard redirect after one failure |
| Per-instance in-memory counters are weaker than expected | Certain | Medium | Documented above; per-account counting still catches the main attack; shared store as follow-up |
| Helmet CORP header breaks image loading in CC-02 | Medium | Low | Re-check when CC-02 lands |

## Rollback

Revert the commit and redeploy. The `RefreshToken` table can stay — it is additive and unused by the
prior code. If access-token lifetime causes problems in production, `ACCESS_TOKEN_TTL` is an env var,
so it can be raised without a deploy.

## Open questions

- Access token TTL: 15 minutes is the conventional default. If the refresh interceptor proves fragile
  on flaky campus wifi, 1 hour is a reasonable compromise. Decide after manual testing.
- Should `/keep-db-alive` (`app.ts:36`) be rate limited or removed? It is an unauthenticated endpoint
  that issues a database query — a trivially cheap amplification vector. Recommend requiring a shared
  secret header, or deleting it if the Supabase pooler no longer needs warming.


---

## Delivery log

### Shipped 2026-09-19 — branch `feat/CC-01-security-baseline` (both repos, off `v1`)

| Item | Criteria |
|---|---|
| Fail-fast env validation (`src/config/env.ts`) | 1, 2, 3 |
| Hardcoded JWT fallback removed from `config/database.ts` | 3 |
| `helmet()` security headers | 10 |
| `trust proxy` + three rate limiters (`src/middleware/rateLimit.ts`) | 4, 5 |
| CC-00 (`.env.example` both repos, gitignore negation, stale `dist/` cleared) | — |

Verified by execution, not inspection: six env-validation cases each in a fresh process (missing,
10-char, 31-char, banned default, missing `DATABASE_URL`, valid); live server boot; helmet headers
present and `X-Powered-By` absent; six sequential failed logins returning `401,401,401,401,401,429`;
a different email still returning `401`, proving per-account keying does not cause collateral
lockout; `tsc --noEmit` and `npm run build` clean.

### Found during implementation — not in the original spec, fixed here

1. **Plaintext passwords were being logged.** `authController.ts:148` ran
   `console.log("Login request received:", req.body)` on every login, and `req.body` contains the
   password. On Vercel that writes every user's password to the platform log stream in clear text.
   Removed, along with three further `console.log` calls leaking user email, approval status, and
   password-validity (a correctness oracle in the log stream).
   **This is the most serious issue found so far — more exposed than the JWT fallback, because it was
   actively writing live credentials to a third-party log retained outside our control.**
2. **User enumeration.** Login returned `"Invalid email"` versus `"Invalid password"`, letting an
   attacker discover which addresses are registered. Both now return `"Invalid email or password"`.
   No frontend code depended on the old strings.
3. **`/keep-db-alive` was an unauthenticated amplification vector** — it sits outside `/api` and runs
   a database query per hit. Now rate limited. The open question below (require a shared secret or
   delete it) still stands.
4. **`JWT_SECRET` was ~10 characters** — brute-forceable, and below the 32-character minimum this
   spec introduces. Rotated to 64 characters locally; see deployment note.
5. **Dependency vulnerabilities:** 22 (14 high) → 5 (4 high) via non-breaking `npm audit fix`. The
   runtime-relevant one, `path-to-regexp` via Express 5's router, is patched (8.3.0 → 8.4.2). The
   four remaining highs are all the `prisma` **CLI**, a devDependency that never ships to the lambda;
   npm's only "fix" is a major *downgrade* to Prisma 6, which would break the Prisma 7 setup to
   patch build tooling. Deliberately not taken — revisit when Prisma 7 ships a patched CLI.

### Deferred to CC-01b — refresh tokens & revocation

Criteria **6, 7, 8, 9, 11** are not met. Access tokens are still 7 days with no revocation path.
Split out because that work needs a **Prisma migration** (`RefreshToken`) plus a frontend axios
interceptor, and migrations require team coordination — the roadmap's one hard rule. Everything
shipped above is additive, needs no migration, and touches no frontend code, so it can land
independently.

Criterion 12 (existing flows still work) needs a manual pass against the running frontend.

### ⚠ Deployment blocker — read before merging

`JWT_SECRET` must be **at least 32 characters in every environment** or the app will refuse to boot.
The local `.env` is rotated; **Vercel is not.** Before this branch reaches a deployed environment,
set a fresh 32+ character `JWT_SECRET` in Vercel for production, preview, *and* development.

That rotation invalidates every issued token and logs all users out — expected and desirable, since
the previous secret was ~10 characters. Generate with `openssl rand -base64 48`.
