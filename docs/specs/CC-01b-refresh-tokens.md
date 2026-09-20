# CC-01b: Refresh tokens & revocation

| | |
|---|---|
| **Status** | **Shipped 2026-09-20 — complete** |
| **Phase** | 0 |
| **Branch** | `feat/CC-01b-refresh-tokens` |
| **Repos** | both |
| **Depends on** | CC-01 |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | 2026-09-20 |

## Problem

CC-01 shipped without criteria 6–9 and 11. The gap it left:

- Access tokens last **7 days** and cannot be revoked (`authController.ts`, `expiresIn: "7d"`).
- A leaked token is valid for a week. There is no denylist and no way to shorten that.
- Logout is client-side only — it deletes `localStorage.token` and nothing else. The token keeps
  working for anyone who captured it.
- `middleware/auth.ts` partly compensates by loading the user on every request and rejecting
  `!isActive`, so deactivation *does* take effect. But that is a blunt instrument: it cannot revoke
  one stolen session without disabling the whole account, and it costs a database round trip on every
  authenticated request.

## Goal

Short-lived access tokens with a revocable refresh token behind them, and a logout that actually ends
the session — without users being bounced to the login screen every fifteen minutes.

## Non-goals / Out of scope

- Removing the per-request user lookup in `authenticate`. It is what makes deactivation immediate;
  correctness beats the saved round trip. Revisit only with measurements.
- Device/session management UI ("sign out everywhere"). The data model supports it; the screen is
  not in scope.
- Cookie-based sessions. Auth stays `Authorization: Bearer`, so CSRF remains inapplicable.
- Changing the face-login flow beyond issuing the same token pair.

## Design

### Two tokens

| | Access | Refresh |
|---|---|---|
| Form | JWT, as today | opaque 48-byte random string |
| Lifetime | 15 min (`ACCESS_TOKEN_TTL`) | 7 days |
| Storage | client only | **SHA-256 hash** in `RefreshToken` |
| Revocable | no — expiry only | yes |

The refresh token is deliberately **not a JWT**. It carries no claims, so it cannot be inspected or
trusted on its own; its only meaning is "this row exists and is not revoked". Storing only the hash
means a database leak does not hand over working sessions.

### Rotation, and what reuse means

Every refresh call revokes the presented token and issues a new one. So a given refresh token is
valid exactly once.

If an **already-revoked** token is presented, that is not a benign retry — the only way it happens is
that someone kept a copy. The response is to revoke **every** refresh token for that user, forcing a
fresh login. This is the standard stolen-token signal, and it is the reason rotation is worth the
complexity: without it, a stolen refresh token is usable for its full seven days undetected.

> A legitimate client can hit this by racing two refreshes. That is why the frontend must
> single-flight the refresh call — see below. Getting that wrong logs users out at random, which is
> the most likely way this feature fails in practice.

### Schema

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  userAgent String?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

Migration `cc01b_add_refresh_tokens`.

### Endpoints

- `POST /api/auth/login` — unchanged inputs; now returns `{ token, refreshToken, user }`.
- `POST /api/auth/face-login` — same.
- `POST /api/auth/refresh` — `{ refreshToken }` → a new pair. Rate limited.
- `POST /api/auth/logout` — revokes the presented refresh token. No longer requires a valid *access*
  token: an expired access token is exactly when logout still needs to work.

### Frontend

A response interceptor that, on `401`:

1. Calls `/auth/refresh` **once**, sharing a single module-level promise across every concurrent
   caller.
2. Retries the original request with the new access token.
3. On failure, clears storage and redirects to login.

The single-flight promise is the crux. A page issuing six parallel requests on a stale token would
otherwise fire six refreshes; five would present an already-rotated token, trigger reuse detection,
and revoke the family — logging the user out for doing nothing wrong.

The refresh call itself must never be retried on 401, or the interceptor recurses forever.

### Backwards compatibility

Clients holding an old 7-day token keep working until it expires; they simply have no refresh token
and will be sent to login at that point. No forced logout on deploy.

## Acceptance criteria

1. Access tokens expire in `ACCESS_TOKEN_TTL` (default 15 min).
2. Login returns both a token and a refresh token.
3. `POST /auth/refresh` with a valid refresh token returns a **new** access token **and** a new
   refresh token.
4. The old refresh token stops working immediately after rotation.
5. Presenting an already-revoked refresh token revokes **all** of that user's refresh tokens.
6. `POST /auth/logout` makes the refresh token unusable.
7. Logout works with an expired access token.
8. Refresh tokens are stored hashed — the raw value appears nowhere in the database.
9. An expired refresh token is rejected.
10. A refresh token belonging to a deactivated user is rejected.
11. The frontend refreshes transparently; the user sees no interruption.
12. Six concurrent 401s trigger exactly **one** refresh call.
13. A failed refresh redirects to login exactly once, without a loop.
14. The refresh endpoint is rate limited.

## Test plan

- **Unit:** hashing; rotation; reuse detection; expiry and deactivated-user rejection.
- **Integration (mocked Prisma):** the endpoints, including logout with an expired access token.
- **Frontend:** single-flight behaviour under concurrent 401s; no retry of the refresh call itself.
- **Manual:** log in, wait past the access TTL, confirm the session continues with no prompt.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Concurrent refreshes trip reuse detection and log users out | **High** | **High** | Single-flight promise on the client; explicit test |
| Interceptor recurses on a failing refresh | Medium | High | The refresh call is exempt from the interceptor; one redirect only |
| 15 min proves too aggressive on flaky campus wifi | Medium | Medium | `ACCESS_TOKEN_TTL` is an env var — raise without a deploy |
| Refresh table grows unbounded | Medium | Low | Expiry index plus cron cleanup |

## Rollback

The migration is additive. Reverting the code leaves the table unused and harmless. Because old
tokens keep working until expiry, neither deploying nor reverting forces a logout.

## Open questions

- Should `userAgent` be recorded? Stored, but nothing reads it yet — it is there for a future session
  list, and it is the kind of thing that is annoying to backfill.


---

## Delivery log

### Shipped 2026-09-20 — branch `feat/CC-01b-refresh-tokens`

Verified live against the running server with a seeded account — **14/14**:

| Check | Result |
|---|---|
| Login returns both tokens | refresh token 64 chars |
| Refresh returns a new pair | both values changed |
| Old refresh token after rotation | `401` |
| Reuse of a rotated token | `401`, and the whole family revoked |
| Logout without a valid access token | `200` |
| Refresh after logout | `401` |
| Unknown token / missing token | `401` / `400` |

And the two guarantees that needed checking directly against the database:

- **Access token TTL is 900 seconds** (was 7 days), decoded from a real token.
- **The raw refresh token is absent from the database** — only the SHA-256 hash is present, confirmed
  by querying for both.

### Found during implementation

1. **Face login would have broken.** It issued the newly-shortened 15-minute access token but no
   refresh token, so those sessions would have died after fifteen minutes with no way to renew.
   Caught by reading the second token-issuance site rather than assuming login was the only one.
2. **`expiresIn` would not typecheck.** jsonwebtoken v9 types it as `number | StringValue`, not
   `string`. Rather than casting, `ACCESS_TOKEN_TTL` is parsed to seconds in `config/env.ts` — the
   env var still accepts "15m" / "2h" / "900", and falls back to 900 on anything unparseable.
3. A local `const refresh` in `login` shadowed the exported `refresh` handler. Renamed.

### Cron consolidation (bundled with this change)

The two cron entries — embeddings at 02:00 and drafts at 02:30 — sat right at Vercel's Hobby limit on
count and frequency. They are now a single `/api/internal/cron/daily` that drains embeddings,
generates drafts, and purges expired refresh tokens.

Each step is isolated: a failure in one is reported and the others still run, because a rate-limited
embedding provider should not stop expired tokens being cleaned up. Verified live — `401` without the
secret, and all three steps reporting with the `Bearer` form Vercel Cron sends.

### Deployment note

`ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL_DAYS` have working defaults, so nothing must be set in
Vercel for this to work. Existing 7-day tokens keep working until they expire, so **the deploy forces
no logout**.
