# CC-62: Two-step verification (TOTP)

| | |
|---|---|
| **Status** | **Implemented** 2026-10-04. Migration applied; verified live end to end |
| **Phase** | 6 |
| **Branch** | `feat/CC-62-totp-2fa` |
| **Repos** | both |
| **Depends on** | CC-01 (shipped) |
| **Blocks** | CC-63 |
| **Estimate** | 3 days |
| **Shipped** | — |

## Problem

A password is the only thing between an attacker and any account, including the admin and super
admin accounts that approve users and see every complaint. Face login (CC-60) is a second factor,
but it needs a camera and offers no way back for someone whose camera is broken.

## Goal

Any user can require a code from an authenticator app after their password. They can recover with
one-time codes if they lose their phone, and a super admin can reset it as a last resort.

## Non-goals

- Making 2FA mandatory for any role. That is a one-line policy change once people have enrolled,
  and a deliberate decision for the college, not a default.
- SMS codes. They are paid, interceptable through SIM swaps, and need a provider.
- WebAuthn / passkeys. A better second factor, and a separate spec.

## Design

**Algorithm.** RFC 6238 (SHA-1, 6 digits, 30-second steps), written against `node:crypto` in
`services/auth/totp.ts` rather than taken from a package. It is forty lines on an authentication
path, and it is tested against the RFC's own vectors.

**Login flow.** `services/auth/session.ts` now owns what a verified first factor earns, through
`afterFirstFactor`. The password path, the face path and the new paths all use it. Before this,
each path minted its own token, and the face path had already drifted: it skipped the admin
last-login stamp.

```
POST /auth/login ──► password ok ──► TOTP on?  ──► { requiresTotp, challengeId, nonce }
                                     face only? ──► { requiresFace, ... }        (CC-60, unchanged)
                                     neither    ──► { token, refreshToken, user }
POST /auth/2fa/verify { challengeId, nonce, code | recoveryCode } ──► { token, ... }
```

TOTP takes precedence over face when both are enrolled, because TOTP has recovery codes.

**Storage** (migration `20261004100000_cc62_cc63_mfa`, additive):

| Where | What | Why |
|---|---|---|
| `User.totpSecretEnc` | AES-256-GCM under `MFA_ENCRYPTION_KEY` | A database copy is not a set of working secrets |
| `User.totpPendingSecretEnc` | Secret during setup | Promoted only once a code proves the app has it, so a botched setup cannot lock anyone out |
| `User.totpLastStep` | Last accepted step | A code seen over a shoulder cannot open a second session in the same 30 seconds. Advanced with a conditional update, so two racing requests cannot both win |
| `RecoveryCode` | SHA-256 of ten `XXXXX-XXXXX` codes | About 49 bits each; case and dashes are forgiven; spent with a conditional update |
| `MfaChallenge` | Same shape as CC-60's `FaceChallenge` | 5-minute life, 5 attempts, nonce stored hashed |

**Endpoints**

| Endpoint | Auth | Notes |
|---|---|---|
| `GET /api/auth/2fa` | any role | Status and recovery codes left |
| `POST /api/auth/2fa/setup` | any role | Pending secret + `otpauth://` URI |
| `POST /api/auth/2fa/enable` | any role | `{ code }` → 10 recovery codes, shown once |
| `POST /api/auth/2fa/disable` | any role | Password **and** a current code or recovery code: a stolen session alone cannot remove the second factor |
| `POST /api/auth/2fa/recovery-codes` | any role | `{ code }` → new set, old set dead |
| `POST /api/auth/2fa/verify` | none, rate-limited | The second step of login |
| `POST /api/admin/users/:id/2fa/reset` | SUPER_ADMIN | Lost phone and codes. Also revokes every session. An ADMIN cannot do it, or one admin could strip another's second factor |

Enable, disable, recovery-code sign-in and admin reset are all written to the audit log (CC-61).
Expired challenges are purged by the daily cron.

**Frontend.** The login page has an authenticator-code step with a "use a recovery code" switch.
The profile page has a setup card with a QR code (`qrcode.react`), the key in text, a code box, and
recovery codes with copy and download. Super admins get a reset button on the user panel.

## Acceptance criteria

1. With 2FA on, a correct password returns a challenge and no token.
2. A current code completes sign-in; a wrong code, a wrong nonce or a spent challenge returns 401.
3. The same code cannot be used twice.
4. A recovery code signs in once, in any case, and reports how many remain.
5. Setup does not take effect until a code from the app is entered.
6. Turning 2FA off needs the password and a code.
7. Only a super admin can reset another user's 2FA, and it signs them out everywhere.
8. Users without 2FA sign in exactly as before.

## Testing

- `totp.test.ts` (21): the RFC 6238 and RFC 4226 vectors, base32, window, replay, input handling.
- `mfaFlow.test.ts` (18 across CC-62/63): criteria 1-6 at the route level.
- Permission matrix: `/api/auth/2fa` for every role; the reset for SUPER_ADMIN only (7).
- **Live, 2026-10-04**, with the seed student account: enable → sign in (challenge, no token) →
  verify → replay refused (401) → lower-case recovery code accepted, 9 left → disable → plain
  sign-in again. The account was left as it started.

## Deployment

Set `MFA_ENCRYPTION_KEY` in Vercel (`openssl rand -base64 32`). A local key was generated into
`.env`. Production needs its own, and **it must never change once people enrol**: a new key makes
every stored secret undecryptable.

## Rollback

Unset `MFA_ENCRYPTION_KEY` and 2FA is off for everyone: login falls back to password (or face).
The columns and tables can stay.
