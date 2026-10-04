# CC-41: Browser push notifications

| | |
|---|---|
| **Status** | **Implemented** 2026-10-04. Migration applied; server path verified live against Google's push service |
| **Phase** | 4 |
| **Branch** | `feat/CC-41-web-push` |
| **Repos** | both |
| **Depends on** | CC-05, CC-03 (outbox) |
| **Blocks** | CC-70 |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

A complaint update or an answer to a doubt only shows up when the person next opens CampusCure.
Email (CC-40) is waiting on a verified domain, and Telegram (CC-42) needs an app and a link step.

## Goal

A user can turn on browser notifications per device and get an alert for each in-app notification,
even with CampusCure closed.

## Non-goals

- Per-type preferences ("only complaints"). Every notification type pushes, as every type rings
  the bell.
- Native app push (FCM/APNs SDKs). This is the Web Push standard only.

## Design

**Delivery is a third outbox channel.** `MessageChannel.PUSH` sits beside `EMAIL` and `TELEGRAM`.
`createNotification` queues one outbox row per device, with `to` set to the `PushSubscription` id,
the body set to a JSON payload, and the dedupe key `notification:<id>:push:<device>`. The drain sends
it with `web-push`, which handles VAPID signing and the RFC 8291 payload encryption. Nothing is sent
inline in a request, because a Vercel lambda can freeze.

**Fixed along the way:** the outbox used to switch off entirely when `RESEND_API_KEY` was unset.
That silently disabled Telegram, which never touches email. Channels are now gated individually
(`enabledChannels()`). A channel without credentials leaves its rows `PENDING` instead of burning
their attempts, so they go out once the key is set.

**Failure handling** follows the email and Telegram senders:

| Push service answer | Meaning | Action |
|---|---|---|
| 404 / 410 | Permission revoked or subscription expired | Delete the subscription; park the row |
| Other 4xx | Our request is wrong | Park, don't retry |
| 5xx, 429, network | Transient | Back off and retry, as for email |

**Subscriptions** (`PushSubscription`, migration `20261004140000_cc41_web_push`):

- Keyed by endpoint (upsert), so a re-subscribe or a different user on a shared browser takes the
  row over rather than duplicating it.
- **https endpoints only.** The drain POSTs to whatever is stored, so a client-chosen `http://` or
  internal address would make the server a request-forgery proxy.
- 10 devices per user at most.
- Independent of the email opt-out: someone who turned off email may well want the browser alert,
  and they turned this on separately.

**Endpoints**

| Endpoint | Auth |
|---|---|
| `GET /api/notifications/push/config` | any role: `{ enabled, publicKey }` |
| `POST /api/notifications/push/subscribe` | any role: `{ subscription }` |
| `POST /api/notifications/push/unsubscribe` | any role: `{ endpoint }`, only the caller's own |

**Frontend.** The service worker (`src/sw.ts`, shared with CC-70) shows each push and, on click,
focuses an open tab or opens `/notifications/:id`. That page resolves the destination with the
existing `getNotificationRoute` and marks the notification read. The profile page has a per-device
on/off card that explains the iOS home-screen requirement and the "blocked in browser" state.
**Logging out turns push off on that device**, so a shared computer stops receiving the last
user's alerts.

## Acceptance criteria

1. A user can turn notifications on and off for one device from their profile.
2. Each in-app notification produces one push per device, deduplicated across retries.
3. Clicking a push opens the page the notification is about.
4. A revoked subscription is deleted on the first failed push.
5. Non-https endpoints are refused.
6. Logging out unsubscribes the device.
7. Push works without email configured.

## Testing

- `push.test.ts` (12): subscription validation (5), owner scoping, per-device fan-out and payload
  size (2), never-throws, and 410 / 4xx / 5xx / vanished-subscription handling (4, 7).
- The outbox tests were updated for per-channel gating.
- Permission matrix: subscribe for every role.
- **Live, 2026-10-04:** config returned the key; an `http://169.254.169.254` endpoint was refused
  (400); a well-formed subscription was stored (201). A test notification queued a PUSH row, the
  drain delivered a signed request to `fcm.googleapis.com`, Google rejected the fabricated
  subscription, and the server deleted it and parked the row. **Still to check by hand:** a real
  browser receiving and clicking a push (criteria 1, 3, 6).

## Deployment

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in Vercel, using the same pair as the
local `.env`. Do not regenerate it: every existing subscription is bound to the public key.
