# CC-42: Telegram notifications

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied; needs a bot token |
| **Phase** | 4 |
| **Branch** | `feat/CC-42-telegram` |
| **Repos** | backend |
| **Depends on** | CC-40 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | — |

## Problem

CC-03 and CC-40 built a complete notification stack that reaches **one inbox**.

Resend will not deliver to an arbitrary address until a domain is verified through DNS. Until
that happens every notification to a student is queued, attempted once, and parked as `FAILED`
with "domain is not verified". CC-31's SLA escalations — the most time-sensitive messages the
system produces — currently reach nobody.

The roadmap deferred WhatsApp because its Business API needs a verified business entity, a Meta
Business account, template pre-approval and per-message fees, and argued that CC-40/41/42 build a
*pluggable multi-channel architecture* where "WhatsApp becomes one more provider the day the
paperwork exists". That argument currently has one provider behind it.

Telegram has none of those gates: a bot token from BotFather is free, instant, and needs no
domain, no DNS and no business verification.

## Goal

A student links their Telegram account once and receives notifications there, through the same
outbox, retry and dedupe machinery email already uses. Two providers over one queue, which is the
architecture claim demonstrated rather than asserted.

## Non-goals / Out of scope

- **A conversational bot.** The bot receives exactly one command, `/start <code>`, to link an
  account. It is a delivery endpoint, not CC-15's chatbot in another window.
- **Group chats or channels.** One chat per user.
- **Per-channel preferences.** `emailNotifications` governs both for now. Splitting them is a
  settings screen nobody has asked for, and the type policy already suppresses the noisy ones.
- **Rich formatting, buttons, inline keyboards.** Plain text with a link.
- **WhatsApp.** Still commercially blocked. This makes the "one more provider" claim true.
- **A frontend linking page.** The endpoint returns a code and a deep link; rendering it is
  frontend work.

## Design

### One outbox, a `channel` column

CC-03's spec said Telegram would be "a sibling, not a branch inside the outbox". In practice the
outbox *row* is channel-agnostic already — a recipient, a subject, a body, retry state — and only
the **provider** differs. So the table gains one column:

```prisma
channel MessageChannel @default(EMAIL)   // EMAIL | TELEGRAM
```

and the drain dispatches on it. Everything else — backoff, the attempt cap, permanent-vs-transient
classification, `dedupeKey`, the batch limit — is reused exactly.

**The table keeps the name `EmailOutbox` even though it is now a message outbox.** Renaming a
table that holds live rows, for cosmetics, in a project mid-flight, is a worse trade than a name
that is slightly wrong. Recorded so the next reader knows it was noticed rather than missed.

`to` holds an email address for `EMAIL` and a Telegram chat id for `TELEGRAM`. Both are opaque
recipient handles to everything above the provider.

### Linking

Telegram will not let a bot message someone who has not messaged it first — which is a feature,
not an obstacle: it makes opt-in structural.

```
GET  /api/me/telegram/link   -> { code, deepLink: "https://t.me/<bot>?start=<code>" }
POST /api/telegram/webhook   <- Telegram delivers "/start <code>"
                                -> look up the code, store chatId, confirm in-chat
DELETE /api/me/telegram/link -> unlink
```

The code is random, single-use and short-lived (`TELEGRAM_LINK_TTL_MINUTES`, default 15). It is
stored hashed for the same reason CC-01b hashes refresh tokens and CC-60 hashes face nonces:
possession of the database should not be possession of a credential.

### Webhook authentication

Telegram's webhook is a public URL, so anything on the internet can POST to it. Telegram supports
a `secretToken` set at registration and returned in the
`X-Telegram-Bot-Api-Secret-Token` header; requests without it are rejected.

Without that check, an attacker who guesses the URL can forge a `/start <code>` from any chat id
and link *their* Telegram to somebody else's account — turning a notification channel into a
disclosure channel.

### Switched off without a token

`TELEGRAM_ENABLED = Boolean(TELEGRAM_BOT_TOKEN)`. With it false, linking refuses, the webhook
404s, and nothing is ever queued on the `TELEGRAM` channel. Following CC-02, CC-03 and CC-60: a
half-configured channel is worse than an absent one.

### Delivery

`sendTelegram` posts to `https://api.telegram.org/bot<token>/sendMessage`. Same permanent-vs-
transient split as Resend: a 4xx other than 429 is permanent — a blocked bot, a deleted chat, a
bad token — and is parked on the first attempt rather than retried five times.

A user who blocks the bot produces `403: bot was blocked by the user`. That is permanent, and it
also means the link is dead, so the chat id is cleared.

### Config

| Var | Default | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | From BotFather. Absent ⇒ the channel is off |
| `TELEGRAM_BOT_USERNAME` | — | For building the deep link |
| `TELEGRAM_WEBHOOK_SECRET` | — | Shared with Telegram at registration |
| `TELEGRAM_LINK_TTL_MINUTES` | `15` | Linking code lifetime |

## Acceptance criteria

1. A linked user gets a notification on both channels.
2. An unlinked user gets email only.
3. `GET /telegram/link` returns a code and a deep link.
4. The code is stored hashed, never in plaintext.
5. An expired code cannot be redeemed.
6. A code is single-use.
7. The webhook rejects a request with no secret token header.
8. The webhook rejects a wrong secret token.
9. A valid `/start <code>` links the chat id.
10. An unknown code is answered without linking anything.
11. Unlinking clears the chat id.
12. With `TELEGRAM_ENABLED` false, nothing queues on the channel and linking refuses.
13. A 403 from Telegram parks the message and clears the chat id.
14. A 429 is retried, not parked.
15. The drain sends `EMAIL` rows through Resend and `TELEGRAM` rows through Telegram.
16. Existing outbox rows default to `EMAIL`.

## Test plan

- **Unit:** channel dispatch in the drain; the Telegram provider's error classification; link code
  generation, hashing, expiry and single use; webhook secret validation.
- **Integration:** the link endpoints across roles; the webhook with and without the secret.
- **Manual:** link a real account against a real bot, trigger a notification, see it arrive.

## Implementation notes 2026-09-21

Built, migration applied. 26 tests; 640 backend tests total.

**Needs a bot token to do anything.** With `TELEGRAM_BOT_TOKEN` unset the channel is
off — linking refuses, the webhook 404s, and nothing queues on it. Setup is in
`.env.example`: BotFather, then one curl to register the webhook with the secret.

The webhook **always answers 200** once authenticated, even on an unparseable update or
an internal error. Telegram retries non-2xx responses and eventually disables a webhook
that keeps failing, so a sticker or a group join must not look like an outage.

A notification to a linked user is queued **twice**, once per channel, with distinct
dedupe keys (`notification:<id>` and `notification:<id>:telegram`). Separate rows mean
one provider being down cannot stop the other, and distinct keys stop the two colliding
on the outbox's unique index.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Forged webhook links an attacker's chat to someone's account | High if unguarded | High | Secret token header checked on every request |
| Link code guessed | Low | High | 32 random bytes, hashed, single use, 15 minutes |
| Bot blocked, messages retry forever | Medium | Low | 403 is permanent; chat id cleared |
| Outbox table name no longer describes it | Certain | Low | Documented; renaming live rows for cosmetics is the worse trade |
| Telegram rate limits | Low | Low | Existing batch cap and backoff apply unchanged |

## Rollback

Revert and drop the `channel` column and the Telegram fields on `User`. Additive migration.
Queued `TELEGRAM` rows would be orphaned — drain or delete them first.

## Open questions

1. Should `emailNotifications` split into per-channel preferences? Only once someone wants one
   without the other.
2. Should the bot answer anything besides `/start`? A `/status` showing open complaints would be
   useful and is CC-15's territory, not a transport's.
