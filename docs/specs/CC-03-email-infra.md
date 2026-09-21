# CC-03: Email infrastructure

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied; sandbox until a domain is verified |
| **Phase** | 0 |
| **Branch** | `feat/CC-03-email-infra` |
| **Repos** | backend |
| **Depends on** | CC-00 (shipped) |
| **Blocks** | CC-31, CC-40, CC-42, CC-63 |
| **Estimate** | 2 days |
| **Shipped** | — |

## Problem

CampusCure cannot send an email. Nothing in `src/` talks to a mail provider, and the only
notification channel that exists is the in-app `Notification` table
(`prisma/schema.prisma:323`), which a student sees only if they happen to open the app.

That is the wrong channel for the things that actually matter. A complaint escalating past its
SLA, a doubt finally getting an answer, a password reset — none of them can reach someone who
is not already looking at the page. Four features are blocked on it: CC-31 (SLA escalation),
CC-40 (email notifications), CC-42 (Telegram, which reuses the same outbox), and CC-63 (email
OTP login).

## Goal

The backend can reliably hand off an email and know whether it was delivered, without a request
handler ever waiting on a mail provider. Failures are retried, retries are bounded, and a
provider outage degrades to "queued" rather than to a 500 or a lost message.

## Non-goals / Out of scope

- **Any actual notification email.** This ships the pipe and one internal endpoint to prove it.
  Which events send mail, and what they say, is CC-40. Resist adding "just the answer
  notification" here — that is how a 2-day infra task becomes a week.
- **Templating.** Subject and body are passed in. A layout system is CC-40's problem, once there
  is more than one email to lay out.
- **Inbound email**, replies, or threading.
- **A separate transactional domain or DKIM setup.** See *Unverified domain* below — this ships
  working within Resend's sandbox and records what production needs.
- **Per-user notification preferences / unsubscribe.** CC-40, and legally it belongs with the
  emails themselves, not the transport.
- **Telegram or web push.** CC-42 and CC-41 are separate providers over this same outbox.

## Design

### Why an outbox, not a direct send

The backend is a Vercel serverless function. Two consequences decide this entire design:

1. **The lambda freezes when the response is sent.** A `setTimeout`, an un-awaited promise, or a
   "fire and forget" send after `res.json()` is not guaranteed to run. Work that must happen has
   to be either awaited or durable.
2. **Awaiting a mail provider inside a request handler makes the user wait for it**, and makes a
   Resend outage into a failed complaint submission.

So an email is *written to a table* inside the same transaction as the thing that caused it, and
a separate drain sends it. The enqueue is a local database insert — fast, and it either commits
with the parent action or does not happen at all.

This is the same shape as CC-10's `EmbeddingJob`, deliberately. A second queue with different
semantics would be one more thing to reason about at 2am.

### Schema

```prisma
model EmailOutbox {
  id          String      @id @default(uuid())
  to          String
  subject     String
  bodyText    String
  bodyHtml    String?
  status      EmailStatus @default(PENDING)
  attempts    Int         @default(0)
  lastError   String?
  /// Set by the caller to make enqueueing idempotent. A retried request that
  /// reuses the key updates nothing and sends nothing twice.
  dedupeKey   String?     @unique
  /// Earliest the drain may pick this up. Backoff pushes it forward.
  scheduledAt DateTime    @default(now())
  sentAt      DateTime?
  providerId  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([status, scheduledAt])
}

enum EmailStatus {
  PENDING
  SENT
  FAILED
}
```

Migration: `cc03_add_email_outbox`.

`dedupeKey` is the piece that makes this safe to call from a retried handler. "Notify the
assignee of complaint X" is naturally idempotent if the key encodes it.

### Drain

`runEmailDrain()` claims a batch of `PENDING` rows whose `scheduledAt` has passed, oldest first,
and sends each through the provider.

- **Success** → `SENT`, `sentAt`, `providerId` recorded.
- **Failure** → `attempts + 1`, `lastError` truncated, and either re-scheduled with exponential
  backoff or parked as `FAILED` once `EMAIL_MAX_ATTEMPTS` is reached.

A parked row is deliberately *not* deleted. "Which emails never went out, and why" is a question
somebody will ask.

Triggered two ways, mirroring CC-10 exactly:

- `triggerEmailDrainInBackground()` immediately after an enqueue, so mail is normally sent within
  a second rather than waiting for cron.
- A `sentEmails` step in the existing consolidated `dailyHandler` (`src/routes/internal.ts`), as
  the safety net for anything the opportunistic drain missed — which is precisely what happens
  when the lambda freezes mid-drain.

The daily cron is the *floor*, not the mechanism. Vercel's Hobby plan caps cron frequency, which
is why the opportunistic trigger exists at all.

### Provider boundary

`src/services/email/resend.ts` is the only module that knows Resend exists, mirroring
`supabaseStorage.ts`. CC-42 adds Telegram as a sibling, not as a branch inside the outbox.

Resend is called over plain `fetch` rather than the SDK: the whole integration is one POST, and
the SDK is a dependency plus bundle weight for nothing.

### Switched off without a key

`EMAIL_ENABLED = Boolean(RESEND_API_KEY)`, following CC-02's `STORAGE_ENABLED`. With it false,
`enqueueEmail` is a no-op that logs, the drain returns zeroes, and nothing queries the table —
which matters because the migration may not be applied everywhere.

An email layer that half-works is worse than one that is off: a queued message nobody drains
looks delivered to the code that queued it.

### Unverified domain — the constraint that will bite

Resend will not send to arbitrary recipients until a domain is verified through DNS. Until then:

- the only usable sender is `onboarding@resend.dev`;
- the only deliverable recipient is the address that owns the Resend account.

This project has **25 real users** in the database, several of them students whose addresses are
real. A drain that sends to `User.email` on an unverified account will not reach them, and on a
*verified* account would reach them — with test mail.

So the config carries a redirect:

```ts
EMAIL_REDIRECT_TO  // when set, every email goes here instead, original recipient in the subject
```

It defaults to on-if-set and is intended to stay set until a domain is verified. The real
recipient is preserved in the row, so nothing is lost and turning the redirect off is a config
change rather than a re-send.

### Config

| Var | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | no | Absent ⇒ `EMAIL_ENABLED` false |
| `EMAIL_FROM` | no | Defaults to `CampusCure <onboarding@resend.dev>` |
| `EMAIL_REDIRECT_TO` | no | Divert all mail here while the domain is unverified |
| `EMAIL_MAX_ATTEMPTS` | no | Default 5 |
| `EMAIL_DRAIN_BATCH_SIZE` | no | Default 20 |

### Endpoints

None public. `POST /api/internal/email/test` and `GET /api/internal/email/stats` sit behind the
existing shared-secret guard, so the pipe can be exercised without a feature depending on it yet.

## Acceptance criteria

1. `enqueueEmail` writes a `PENDING` row and sends nothing synchronously.
2. Enqueueing twice with the same `dedupeKey` produces one row.
3. The drain sends a `PENDING` row and marks it `SENT` with a `providerId`.
4. A provider failure increments `attempts`, records `lastError`, and leaves the row `PENDING`.
5. Backoff pushes `scheduledAt` forward, and a row scheduled in the future is not picked up.
6. A row reaching `EMAIL_MAX_ATTEMPTS` becomes `FAILED` and is never retried again.
7. A `FAILED` row is retained, not deleted.
8. With `EMAIL_ENABLED` false, `enqueueEmail` is a no-op and touches no table.
9. With `EMAIL_ENABLED` false, the drain returns zeroes without querying.
10. With `EMAIL_REDIRECT_TO` set, the provider receives that address, and the row still records
    the real recipient.
11. The drain is idempotent: a `SENT` row is never sent twice.
12. The internal endpoints reject a request with no shared secret.
13. The daily cron reports an email step alongside the existing ones.
14. An invalid recipient is rejected at enqueue time, not after four retries.

## Test plan

- **Unit:** enqueue (dedupe, disabled, validation); drain state machine — success, retry,
  backoff arithmetic, parking at the cap, skipping future-scheduled and already-sent rows;
  redirect behaviour. Resend is mocked at the `resend.ts` boundary; no test touches the network.
- **Integration:** the two internal endpoints with and without the secret, added to the existing
  guard tests.
- **Manual:** one real send to the Resend account owner's address, confirming `providerId` is
  recorded and the message arrives.

## Implementation notes 2026-09-21

Built, migration applied. 31 tests across `emailOutbox.test.ts` (18),
`emailProvider.test.ts` (9) and `emailDisabled.test.ts` (4) — 400 backend tests total.

**Still in Resend's sandbox.** Until a domain is verified through DNS, the only sender
is `onboarding@resend.dev` and the only deliverable recipient is the Resend account
owner. Everything else is queued, attempted, and parked as `FAILED` with "domain is not
verified" as `lastError` — correctly, and on the first attempt rather than the fifth,
because a 4xx that is not 429 is treated as permanent.

So the pipe is finished and the delivery is not. That is the right place to stop: CC-40
owns the emails themselves, and reviewing those before a domain is verified is the
order that keeps test mail away from 25 real students.

To exercise it end to end, set `EMAIL_REDIRECT_TO` to your own address and POST to
`/api/internal/email/test` with the shared secret and a `to` field.

One thing to know if you write a standalone script against this: importing
`config/database.js` keeps its pg pool open, so a script that only calls
`prisma.$disconnect()` will hang rather than exit. The internal endpoint is the
intended way to drive the drain by hand.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Test mail reaches 25 real students | Medium | High | `EMAIL_REDIRECT_TO`, on until a domain is verified; real recipient preserved in the row |
| Lambda freezes mid-drain, rows stuck `PENDING` | High | Low | Claim-then-send, and the daily cron re-picks anything still pending |
| Two drains run concurrently and double-send | Low | Medium | Status moves to `SENT` before the row is considered done; `dedupeKey` bounds the damage |
| Resend free tier (100/day) exhausted | Medium | Medium | Bounded retries, batch cap, `FAILED` rows visible in stats |
| An unbounded `lastError` fills the table | Low | Low | Truncated to 500 chars |
| API key leaks | Low | High | Read only in `resend.ts`, never returned in a response, `.env` is gitignored |

## Rollback

Revert the code. The migration is additive — `EmailOutbox` is a new table nothing references — so
leaving it costs nothing and dropping it destroys the record of what was sent. Prefer leaving it.

Mail already handed to Resend is external state and cannot be recalled.

## Open questions

1. Should `FAILED` rows be swept after N days? They are the audit trail, so probably not until
   CC-64 sets a retention policy.
2. Does CC-40 want a `Notification` → `EmailOutbox` foreign key, or is the dedupe key enough?
   Leaning dedupe key — it keeps the transport ignorant of what it is carrying.
