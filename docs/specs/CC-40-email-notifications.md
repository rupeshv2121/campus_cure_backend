# CC-40: Email notifications

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied |
| **Phase** | 4 |
| **Branch** | `feat/CC-40-email-notifications` |
| **Repos** | backend |
| **Depends on** | CC-03 (shipped) |
| **Blocks** | CC-42 |
| **Estimate** | 2 days |
| **Shipped** | 2026-09-21 |

## Problem

CC-03 built a working email pipe and nothing sends through it. Every notification in the
system still lands only in the `Notification` table (`src/utils/notifications.ts:12`), which a
student sees if and only if they open the app and look at the bell.

That is fine for "your answer got an upvote" and useless for the things with a deadline. A
complaint sitting in `PENDING_CONFIRMATION` waits on a student who does not know it is waiting.
A faculty member assigned a complaint finds out next time they log in. CC-31 (SLA escalation)
is meaningless without a channel that reaches someone who is not already looking.

## Goal

Notifications that matter arrive by email as well as in-app, without any caller having to know
email exists. A user can turn them off from the email itself, and a mail failure can never
damage the in-app notification that caused it.

## Non-goals / Out of scope

- **A frontend preferences UI.** The roadmap scopes CC-40 to the backend. Opting out works from
  the unsubscribe link in every email, which is the place people actually look for it. A toggle
  in the profile page is a small follow-up, not part of this.
- **Per-type preferences.** One switch, all-or-nothing. Granular controls are a settings screen
  nobody has asked for yet, and the type policy below already suppresses the noisy ones.
- **Digests or batching.** One notification, one email.
- **Rich HTML design.** A readable, single-column HTML body plus a text alternative. A template
  system with a layout and brand assets is not worth it for four emails.
- **Telegram / push.** CC-42 and CC-41, over the same outbox.
- **Re-sending mail for notifications created before this shipped.**

## Design

### One hook, not many call sites

Every notification in the codebase already funnels through `createNotification`. The email
channel attaches there, so no controller changes and no caller learns about email:

```
notifyComplaintAssignment ─┐
notifyDoubtAnswer ─────────┼─> createNotification ─> Notification row
notifyComplaintStatusChange┘                      └─> enqueueEmail (CC-03 outbox)
```

Adding a fifth notification helper later gets email for free, which is the point.

### Not every notification deserves an email

`ANSWER_UPVOTED` by email is how a product teaches people to filter it. The policy is a table
keyed by `NotificationType`:

| Type | Email | Why |
|---|---|---|
| `COMPLAINT_STATUS_UPDATE` | yes | Often needs the student to act — confirmation, feedback |
| `COMPLAINT_ASSIGNED` | yes | Someone now owns work they do not know about |
| `DOUBT_ANSWER` | yes | The reason the student asked; often days later |
| `DOUBT_ACCEPTED` | yes | Infrequent and meaningful |
| `ANSWER_UPVOTED` | **no** | High volume, zero urgency |
| `GENERAL` | **no** | Unclassified by definition; opt in explicitly per call |

A caller can override with `email: true | false` where it genuinely knows better.

### A mail failure must not damage a notification

`createNotification` currently throws on error and its callers let that propagate. Email is
strictly additive, so the enqueue is wrapped: any failure is logged and swallowed, and the
notification is returned regardless.

The inverse is already handled by CC-03 — a provider outage leaves the row `PENDING` rather
than failing anything.

`dedupeKey` is `notification:<id>`. The notification id is unique and stable, so a retried
handler cannot produce a second email.

### Opting out

Two fields on `User`:

```prisma
emailNotifications Boolean @default(true)
/// Random, per user, and NOT derived from the id: an unsubscribe link is
/// emailed in clear text and appears in logs and forwarded messages.
unsubscribeToken   String? @unique
```

The token is minted lazily on first email and reused, so existing rows need no backfill.

**Unsubscribing is a POST, never a bare GET.** Mail clients and security scanners prefetch links,
and a GET that mutates would silently unsubscribe people who never clicked. `GET
/api/notifications/unsubscribe/:token` returns a small confirmation page; the form POSTs to the
same path.

Defaults to on. Everything sent is transactional — about the sender's own complaint or their own
doubt — not marketing.

### Rendering

`src/services/email/templates.ts` renders `{ subject, text, html }` from a notification. One
layout: title, message, a link to the relevant page, and the unsubscribe line. HTML is built by
escaping every interpolated value — notification titles contain user-supplied complaint and
doubt titles, so this is the one place in the email path where injection is possible.

`FRONTEND_URL` drives deep links, falling back to the deployed frontend when unset.

### Config

| Var | Purpose |
|---|---|
| `NOTIFICATION_EMAILS_ENABLED` | Master switch, default on. Off ⇒ no notification ever emails, regardless of type or user preference |

Everything else is inherited from CC-03, including `EMAIL_REDIRECT_TO`, which stays on until a
domain is verified.

## Acceptance criteria

1. Creating a `DOUBT_ANSWER` notification queues exactly one email.
2. Creating an `ANSWER_UPVOTED` notification queues none.
3. An explicit `email: false` suppresses one that would otherwise send.
4. An explicit `email: true` sends one that policy would suppress.
5. A user with `emailNotifications = false` gets the in-app notification and no email.
6. With `NOTIFICATION_EMAILS_ENABLED=false`, nothing is queued for any type.
7. With `EMAIL_ENABLED` false (no key), the notification is still created.
8. An enqueue that throws does not prevent the notification being created or returned.
9. The dedupe key is `notification:<id>`, so a repeat cannot double-send.
10. The email body escapes HTML in a doubt or complaint title.
11. `GET /unsubscribe/:token` does **not** change anything; `POST` does.
12. An unknown or absent token returns 404 and changes nothing.
13. Unsubscribing is idempotent.
14. The unsubscribe token is not derivable from the user id.
15. A user with no token gets one minted on their first email.

## Test plan

- **Unit:** the type policy; override precedence (explicit > policy); the preference and master
  switches; enqueue failure swallowed; dedupe key; template escaping and link building.
- **Integration:** the unsubscribe routes — GET is inert, POST acts, unknown token 404s, repeat
  POST is a no-op. Added to the existing route tests.
- **Manual:** with `EMAIL_REDIRECT_TO` set, answer a doubt and confirm one message arrives with a
  working unsubscribe link.

## Implementation notes 2026-09-21

Built, migration applied. 33 tests (`notificationEmail.test.ts` 25,
`unsubscribe.test.ts` 8); 433 backend tests total.

**A bug caught while writing it:** the unsubscribe link was being built from
`FRONTEND_URL`, but `/api/notifications/unsubscribe/:token` is served by the *backend*,
which is a different origin. Every recipient would have got a 404 on the one link they
are legally entitled to. Added `PUBLIC_API_URL` and a test asserting the link points at
the API rather than the app.

`createNotification` now destructures `email` out of its params before the Prisma
create, so the override never reaches the database as a column.

Delivery is still gated on CC-03's sandbox: until a domain is verified, mail to anyone
but the Resend account owner is queued, attempted once and parked as `FAILED`. Set
`EMAIL_REDIRECT_TO` to see the real thing.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A burst of notifications exhausts the Resend free tier | Medium | Medium | Noisy types excluded by policy; CC-03 caps the drain batch; `FAILED` rows visible in stats |
| Test mail reaches 25 real students | Medium | High | `EMAIL_REDIRECT_TO` from CC-03, on until a domain is verified |
| Scanner prefetch silently unsubscribes users | Medium | Medium | GET is inert; POST performs |
| HTML injection via a doubt title | Low | Medium | Every interpolated value escaped; criterion 10 |
| Email failure breaks complaint assignment | Low | High | Enqueue wrapped, failures logged and swallowed; criterion 8 |

## Rollback

Revert the code. The migration adds two nullable/defaulted `User` columns and is additive;
leaving it is harmless. Mail already queued will still drain — set
`NOTIFICATION_EMAILS_ENABLED=false` first if that is not wanted.

## Open questions

1. Should `COMPLAINT_STATUS_UPDATE` email on *every* transition, or only the ones needing action
   (`PENDING_CONFIRMATION`, `RESOLVED`, `ESCALATED_TO_SUPERADMIN`)? Shipping all of them; worth
   narrowing if it proves noisy.
2. A profile toggle mirroring `emailNotifications` is an obvious small follow-up once someone
   asks for it.
