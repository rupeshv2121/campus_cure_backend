# CC-60: Face login hardening

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied, templates encrypted |
| **Phase** | 6 |
| **Branch** | `feat/CC-60-face-hardening` |
| **Repos** | both |
| **Depends on** | CC-01 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 4 days |
| **Shipped** | 2026-09-21 |

## Problem

`POST /api/auth/face-login` (`src/controllers/authController.ts:465`) is an **unauthenticated
endpoint that issues a full session**. It takes a 128-element descriptor, scans every enrolled
user, and logs in whoever is nearest under a fixed `0.6` threshold. Four things are wrong with
it, and they are not equally important.

**1. The descriptor is computed in the browser.** This is the one that decides the whole design.
`face-api.js` runs client-side and POSTs the result, so the camera is not part of the security
boundary at all. An attacker does not need a photo, a mask, or a screen — they need 128 floats
and `curl`. Every anti-spoofing measure that runs in the browser is advisory, because the
attacker controls the browser.

That makes face-as-a-first-factor equivalent to a **bearer secret that is stored in the database
and re-derived from anyone's photograph**. Liveness detection cannot fix it. Only requiring
something the attacker does not have can.

**2. No claimed identity.** 1:N identification means the attacker needs no username, and false
match rate grows with enrolment. Today that risk is small in practice — **1 of 25 users is
enrolled and no admin is** — but the property is wrong regardless of the count.

**3. A printed photo authenticates.** With no liveness signal at all, holding a photo to the
webcam produces a valid descriptor. This matters for the honest-browser case even though (1)
makes it not the attacker's easiest path.

**4. `User.faceDescriptor` is plaintext.** A `Float[]` of biometric template data, readable by
anything with database access, and regulated under the DPDP Act. A leaked descriptor is
permanent in a way a leaked password is not — the subject cannot change their face.

## Goal

Face recognition stops being a way to get a session and becomes a second step on top of a
password. Templates are encrypted at rest, matching is 1:1 against a claimed identity, and the
obvious replay and photo attacks cost something instead of nothing.

## Non-goals / Out of scope

- **Real presentation-attack detection.** Proper liveness is a server-side model over raw frames,
  or a device attestation API. Neither is reachable here. What this ships raises the cost of the
  casual attack and is documented as exactly that — not as proof of life.
- **Moving recognition to the server.** It would fix (1) properly, and it means shipping frames
  to a Vercel lambda, a model to run them through, and a bill. Recorded under *Open questions*.
- **Biometric consent flows and retention policy** — CC-64 (DPDP) owns those. This makes the
  data defensible; CC-64 makes its handling compliant.
- **Key rotation tooling.** One key, one env var. Rotation is a script when it is first needed.
- **Removing face login entirely.** Tempting, and a real option. The feature demos well and the
  fix below makes it defensible, so it stays.

## Design

### Face becomes the second factor, not the first

The password goes first. Only after it verifies does the face step run, and it runs **1:1**
against that one account.

```
POST /api/auth/login  { email, password }
   │  password wrong ──────────────> 401
   │  no face enrolled ────────────> tokens, as today
   └─ face enrolled ───────────────> 200 { requiresFace: true, challengeId, nonce }
                                          (NO tokens issued)

POST /api/auth/face/verify  { challengeId, nonce, descriptors[] }
   └─ 1:1 match against the challenge's user ──> tokens
```

This is what makes the design defensible despite (1). A stolen descriptor is now worth nothing
on its own, because the attacker still needs the password — and if they have the password, the
face step is the thing standing in the way rather than the thing they bypassed.

**`POST /api/auth/face-login` is deleted, not deprecated.** Leaving an unauthenticated 1:N
session-issuing endpoint in the codebase behind a flag is the same vulnerability with extra
steps.

### The challenge

A `FaceChallenge` row is created by the password step and consumed by the face step:

```prisma
model FaceChallenge {
  id        String    @id @default(uuid())
  userId    String
  /// SHA-256 of the nonce, never the nonce. A leaked table must not let
  /// anyone complete a pending challenge - same reasoning as RefreshToken.
  nonceHash String    @unique
  expiresAt DateTime
  consumedAt DateTime?
  attempts  Int       @default(0)
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

- **Short-lived** (`FACE_CHALLENGE_TTL_SECONDS`, default 120). A captured request is not
  replayable an hour later.
- **Single-use.** `consumedAt` is set on the first verify, success or failure.
- **Attempt-capped.** Three tries, then the challenge is dead and the password step must run
  again. This is what stops descriptor-space brute force against a known account.
- **Hashed.** Consistent with CC-01b's refresh tokens: possession of the database is not
  possession of a credential.

Expired rows are cleaned up by the existing daily cron.

### Liveness, honestly

The client submits **three descriptors from three moments**, not one. A static photo produces
near-identical descriptors every frame; a live face does not sit perfectly still.

Server-side:

- every descriptor must match the stored template (all three under threshold), and
- the descriptors must not be *too* identical to one another — pairwise distance above
  `FACE_LIVENESS_MIN_VARIANCE`, default `0.02`.

**What this is worth:** it defeats a held-up photograph and a replayed single capture. It does
**not** defeat an attacker who posts three slightly perturbed vectors, which is trivial. It is a
speed bump for the honest-browser case, and the spec says so rather than calling it liveness
detection. The password is the control.

The threshold also tightens from `0.6` to `FACE_MATCH_THRESHOLD`, default `0.5`. `0.6` is
`face-api.js`'s suggested cut-off for 1:N *identification* where a miss is an inconvenience; for
1:1 *verification* guarding a session, a tighter bound costs a retry and buys margin.

### Encryption at rest

`faceDescriptor Float[]` is replaced by `faceDescriptorEnc String?` — AES-256-GCM, key from
`FACE_ENCRYPTION_KEY`, stored as `iv:tag:ciphertext` in base64.

GCM rather than CBC because it authenticates: a tampered template fails to decrypt instead of
silently comparing against modified data.

This is only affordable because matching is 1:1. Decrypting every enrolled template on every
login attempt — what 1:N would require — would be both slow and a much larger exposure window.

Migration is additive plus a one-time script (`encryptFaceDescriptors.ts`) that reads the
plaintext column, writes the encrypted one, and clears the original. **One user is enrolled**, so
this is small; the script is idempotent and skips rows already migrated.

With no `FACE_ENCRYPTION_KEY` set, face login is **off** — `FACE_LOGIN_ENABLED` false, enrolment
refuses, and the password step never returns `requiresFace`. Following CC-02 and CC-03: a
half-configured biometric path is worse than none.

### Lockout and recovery

A user who enrols a face and then cannot present it is locked out, since the face step is
mandatory once enrolled. Two escape hatches:

- `DELETE /api/auth/face-descriptor` (authenticated) — un-enrol from an existing session.
- An admin clearing the descriptor for a user who has lost access, which is an ordinary
  account-recovery action and is logged.

Recorded here because "we added 2FA and someone got locked out" is the predictable failure.

### Config

| Var | Default | Purpose |
|---|---|---|
| `FACE_ENCRYPTION_KEY` | — | 32 bytes, base64. Absent ⇒ face login off entirely |
| `FACE_MATCH_THRESHOLD` | `0.5` | Max euclidean distance for a 1:1 match |
| `FACE_LIVENESS_MIN_VARIANCE` | `0.02` | Min pairwise distance across submitted frames |
| `FACE_CHALLENGE_TTL_SECONDS` | `120` | Challenge lifetime |
| `FACE_MAX_ATTEMPTS` | `3` | Verifies allowed per challenge |
| `FACE_REQUIRED_SAMPLES` | `3` | Descriptors the client must submit |

### Frontend

`FaceLoginPage` stops being a login entry point and becomes the second step of the existing
password flow: capture three samples a few hundred milliseconds apart, POST them with the
challenge, then store tokens exactly as password login does. The standalone "log in with your
face" route is removed along with the endpoint behind it.

## Acceptance criteria

1. `POST /api/auth/face-login` no longer exists (404).
2. Password login for a user with no enrolled face is unchanged and returns tokens.
3. Password login for an enrolled user returns `requiresFace` and **no tokens**.
4. A wrong password returns 401 and creates no challenge.
5. `face/verify` with a valid challenge and matching descriptors returns tokens.
6. `face/verify` with descriptors from a different user is rejected.
7. A consumed challenge cannot be reused.
8. An expired challenge is rejected.
9. A challenge is rejected after `FACE_MAX_ATTEMPTS` failures.
10. A challenge id without its nonce is rejected.
11. Fewer than `FACE_REQUIRED_SAMPLES` descriptors is rejected.
12. Three near-identical descriptors are rejected as a static image.
13. Descriptors that vary but do not match the template are rejected.
14. The stored template round-trips through encrypt/decrypt.
15. A tampered ciphertext fails to decrypt rather than returning wrong data.
16. Two encryptions of one descriptor produce different ciphertext (unique IV).
17. With no `FACE_ENCRYPTION_KEY`, enrolment refuses and login never asks for a face.
18. `DELETE /api/auth/face-descriptor` un-enrols and a subsequent login needs no face.
19. No endpoint ever returns a descriptor, encrypted or otherwise.
20. Expired challenges are removed by the daily cron.

## Test plan

- **Unit:** encrypt/decrypt round trip, IV uniqueness, tamper detection, missing key; distance
  and variance maths; the challenge state machine — expiry, single use, attempt cap, wrong nonce.
- **Integration:** the full two-step login across roles; the deleted endpoint 404s; authz matrix
  rows for the new routes.
- **Manual:** enrol, log in with password + live face, then retry holding a photo of that face to
  the camera and confirm it is rejected.

## Implementation notes 2026-09-21

Built, migration applied, and **the plaintext templates are gone**:
`encryptFaceDescriptors.ts --apply` migrated the one enrolled account and cleared
`User.faceDescriptor`, which now reads `0` rows holding plaintext. That column can be
dropped in a later migration.

48 tests (`faceCrypto.test.ts` 20, `faceChallenge.test.ts` 14, `faceLoginFlow.test.ts`
14); 481 backend tests total.

`POST /api/auth/face-login` is deleted — a test asserts it 404s, so it cannot come back
by accident.

The attempt counter increments *before* the descriptors are examined. Counting after
would let a caller abandon each request and get unlimited tries.

Every verify failure returns one message, `"Face verification failed."`, whether the
challenge expired, was consumed, had the wrong nonce, or the face did not match.
Distinguishing them tells an attacker which half of their guess was right. The real
reason is logged server-side.

**A key was generated and written to the backend `.env`.** It must be set in Vercel too.
If it is not, face login is simply off there and enrolled users sign in with a password
alone — a safe degradation, but not the intended one.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Attacker posts a stolen descriptor directly | High (trivial) | Low now | Password required first; descriptor alone is worthless |
| Variance check defeated by perturbed vectors | High for a determined attacker | Low | Acknowledged, not claimed as liveness; password is the control |
| User locked out after enrolling | Medium | Medium | Un-enrol endpoint, admin clear, documented |
| Encryption key lost | Low | High | Templates unrecoverable — but re-enrolment is a 30-second user action, so this is inconvenience not disaster |
| Key committed to source | Low | High | `.env` gitignored; CC-01's banned-secret check already guards the JWT secret |
| Tighter threshold rejects legitimate users | Medium | Low | Configurable; three samples give three chances within one challenge |

## Rollback

Revert the code. **The migration is not symmetric**: once `encryptFaceDescriptors.ts` has run,
the plaintext column is cleared, and reverting to the old code leaves face login unable to read
any template. Affected users must re-enrol, which is a 30-second action for the one enrolled
account today.

Do not roll back by restoring plaintext biometrics.

## Open questions

1. Should recognition move server-side? It is the only real fix for the descriptor-is-computed-
   in-the-browser problem, and it costs a model in the request path. Worth revisiting if face
   login ever guards anything more than a student account.
2. Should admins and super-admins be barred from enrolling at all? Nobody privileged is enrolled
   today, and the blast radius argument says keep it that way.
3. `FACE_LIVENESS_MIN_VARIANCE = 0.02` is a guess, not a measurement. It needs calibrating
   against real captures the way CC-13's duplicate threshold was.
