# CC-63: Email sign-in codes

| | |
|---|---|
| **Status** | **Implemented** 2026-10-04. Dormant until a sending domain is verified and `EMAIL_REDIRECT_TO` is cleared |
| **Phase** | 6 |
| **Branch** | `feat/CC-63-email-otp` |
| **Repos** | both |
| **Depends on** | CC-03 (implemented), CC-62 (implemented) |
| **Blocks** | nothing |
| **Estimate** | 2 days |
| **Shipped** | — |

## Problem

A forgotten password has no self-service way back. Students who sign in once a month forget it,
and today the fix is asking an admin.

## Goal

Anyone can sign in with a six-digit code emailed to their address, instead of a password.

## Non-goals

- **Replacing the second factor.** The code replaces the password only. A user with 2FA still
  gets the authenticator step afterwards, and a user with face login still gets the face step.
- Password reset. A code gets you in; changing the password is the profile page's job.
- Magic links. A link in an email can be opened by a mail scanner that follows every URL. A typed
  code cannot.

## Design

```
POST /auth/email-login/request { email }        ──► always 200, same message
POST /auth/email-login/verify  { email, code }  ──► afterFirstFactor(): session, or TOTP/face challenge
GET  /auth/methods                              ──► { emailCode } so the login page only offers what works
```

**Security rules, each enforced in code:**

1. **No enumeration.** The request endpoint answers identically for unknown addresses, and a
   failed send is logged and swallowed, so the response never differs.
2. **Off while `EMAIL_REDIRECT_TO` is set.** The redirect sends every email to one inbox, which
   would receive every user's sign-in code and could sign in as anyone. `EMAIL_LOGIN_ENABLED`
   checks for it.
3. **Not through the outbox.** CC-03's outbox stores message bodies, and a code at rest in a table
   is a credential at rest. Codes are sent directly through Resend.
4. **Keyed hash.** There are only a million six-digit codes, so plain SHA-256 is reversed by trying
   them all. `EmailLoginCode.codeHash` is HMAC-SHA-256 under `MFA_ENCRYPTION_KEY`.
5. **Limits.** A code lives 10 minutes and dies after 5 wrong guesses; a new request replaces the
   old code. Requests are limited to 3 per address and IP per 15 minutes, counting every request.
   The usual auth limiter only counts failures, and this endpoint never fails, so with it anyone
   could flood a stranger's inbox from our domain.

Schema: the `EmailLoginCode` table, in CC-62's migration.

## Acceptance criteria

1. Known and unknown addresses get the same response; only the known one is emailed.
2. The stored hash is neither the code nor its plain SHA-256.
3. A correct code for a 2FA user returns a TOTP challenge, not a token.
4. A wrong code returns 401 and counts an attempt.
5. With `EMAIL_REDIRECT_TO` set, the feature reports itself off and the login page hides it.

## Testing

`mfaFlow.test.ts` covers 1-4. Criterion 5 was checked live on 2026-10-04: `/auth/methods`
returned `{ emailCode: false }` because the local `.env` has a redirect set.

## To switch it on

1. Verify a sending domain in Resend and set `EMAIL_FROM` to an address on it.
2. Review the CC-40 emails, then **remove** `EMAIL_REDIRECT_TO`.
3. Make sure `MFA_ENCRYPTION_KEY` is set (CC-62).
