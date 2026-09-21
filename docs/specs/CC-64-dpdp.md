# CC-64: DPDP compliance — consent, export, erasure, retention

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied |
| **Phase** | 6 |
| **Branch** | `feat/CC-64-dpdp` |
| **Repos** | backend |
| **Depends on** | CC-61 (shipped) |
| **Blocks** | nothing |
| **Estimate** | 3 days |
| **Shipped** | 2026-09-21 |

## Problem

CampusCure holds a lot of personal data and gives its subjects no rights over any of it.

`StudentProfile` (`prisma/schema.prisma:56`) stores, per student: `phoneNumber`, `address`,
`guardianName`, `guardianPhone`, `enrollmentNumber`, department, branch and semester. `User` adds
name, email and — since CC-60 — an encrypted biometric template. Around that sit complaints
(which describe where a student is and what is broken there), doubts, answers, notifications,
queued emails containing message bodies, IP addresses in the audit log, and view history.

Today there is:

- **no record that anyone consented** to any of it, or to what;
- **no way to get a copy** of what is held about you;
- **no way to have it erased** — and no way for an admin to do it either;
- **no retention limit** on anything. `Notification`, `DoubtView` and `EmailOutbox` grow forever.

CC-60 made the biometric data *defensible* — encrypted at rest, matched 1:1, never returned. It
did not make holding it *lawful*, because lawfulness under the DPDP Act is about consent,
purpose limitation, retention and data-principal rights, none of which exist here.

CC-61 built the prerequisite: a queryable record of what was done to whose data.

## Goal

A user can see what CampusCure holds about them, take a copy, and have it erased — and the
system stops keeping things it no longer needs. Every one of those events is recorded in the
audit log.

## Non-goals / Out of scope

- **Verifiable parental consent for minors.** DPDP requires it for under-18s, and this system
  stores `guardianName` and `guardianPhone`, which means somebody already anticipated minors.
  There is no date of birth anywhere in the schema, so the system cannot currently tell who is
  one. **This is a real compliance gap and inventing a mechanism would paper over a decision that
  is legal, not technical.** Flagged loudly under *Open questions*; not built.
- **A Consent Manager integration.** DPDP's registered-intermediary model is out of reach.
- **Grievance officer workflow and breach notification.** Process, not code.
- **Cross-border transfer rules.** The database is in `ap-southeast-1` (Singapore) — worth a
  decision, not a feature.
- **A frontend.** Backend only, per the roadmap's shape for CC-61/CC-64. Endpoints are built so a
  UI needs no migration.
- **Retroactive consent for the 25 existing users.** Consent cannot be backdated. Existing
  accounts are marked as pre-dating the policy and prompted on next login — that prompt is
  frontend work, so this ships the record and the endpoint.

## Design

### Erasure is anonymisation, not deletion

This is the central decision, and three independent facts force it.

**1. The database will not allow a hard delete.** `StudentProfile.user`, `Doubt.postedBy`,
`Answer.answeredBy` and `Complaint.raisedBy` are all plain relations with no `onDelete: Cascade`,
so deleting a `User` row raises a foreign key violation today. Erasure would have to cascade
manually through nine tables.

**2. Deleting content destroys other people's data.** A doubt with twelve answers is not only its
author's. Removing it erases the work of everyone who replied and the value it has for every
student who searches for it later. DPDP grants erasure of *personal data*, not of everything a
person ever touched.

**3. CC-61 made the audit log immutable — deliberately.** A database trigger raises on `UPDATE`
and `DELETE`. So "erase everything about this person" cannot include the audit log, and any
design that assumed it could would either fail at runtime or require dismantling the control
shipped last week.

So erasure **anonymises**: identifiers are replaced, content is reattributed to a tombstone, and
the rows that are purely personal are deleted outright.

| Data | On erasure |
|---|---|
| `User.name`, `email`, `userID` | Replaced with `deleted-<short id>` values |
| `User.password` | Replaced with an unusable random hash |
| `User.faceDescriptorEnc` | **Deleted** — biometric, no reason to keep |
| `StudentProfile` / `FacultyProfile` | Phone, address, guardian name and phone **cleared** |
| Doubts, answers, complaints | **Kept**, authored by the tombstone account |
| Complaint description | **Kept** — it describes a room, not a person |
| Notifications, bookmarks, views, upvotes | **Deleted** — purely personal, no value to others |
| Refresh tokens, face challenges | **Deleted** — sessions end |
| `EmailOutbox` rows to that address | **Deleted** — they contain the address and message |
| `AuditLog` | **Kept**. See below |

The account is marked `isActive: false` and `erasedAt` is set, so it cannot be logged into and is
visibly gone rather than silently broken.

### The audit log keeps the actor, and that is a deliberate trade

An erased user's `actorId`, `actorLabel` and `ip` remain in `AuditLog`, because the trigger
forbids modifying it and because a trail that can be edited by the person it describes is not a
trail.

The justification is retention under legitimate interest, and it only holds because the data
there is *minimal*: an id, a role, a user code, an IP. It does not contain names, addresses,
phone numbers or content. Recorded here so that the trade is a decision rather than an oversight,
and revisited in *Open questions* — the cleanest fix is to stop writing IP addresses at all,
which is a change to CC-61 and not something to slip into this spec.

### Consent

```prisma
model ConsentRecord {
  id            String   @id @default(uuid())
  userId        String
  policyVersion String
  granted       Boolean
  /// What the user was actually shown, so "what did I agree to" is answerable
  /// from the record rather than from whatever the site says today.
  purposes      String[]
  ip            String?
  userAgent     String?
  createdAt     DateTime @default(now())
}
```

Append-only by convention (no update path), one row per grant or withdrawal, so the history is
reconstructable. `policyVersion` is a constant in code; bumping it invalidates prior consent and
the user is asked again.

Withdrawal is recorded but does **not** cascade to erasure — they are separate rights and
conflating them would surprise someone who only wanted to stop the emails.

### Export

`GET /api/me/data-export` returns everything held about the caller as JSON: profile, complaints,
doubts, answers, notifications, consent history, and the audit entries where they are the actor
or the target.

Never included: the password hash, the encrypted face template, refresh token hashes, challenge
nonces. Exporting a credential to whoever is logged in is how a portability feature becomes an
account-takeover feature. The export *states* that a face template exists rather than shipping
it.

### Retention

A sweep in the existing daily cron, with per-table limits:

| Table | Kept for | Why |
|---|---|---|
| `Notification` | 180 days | Read or not, a six-month-old bell item has no use |
| `DoubtView` | 90 days | Only feeds a view counter that is already denormalised |
| `EmailOutbox` (`SENT`) | 90 days | Delivery evidence; the body contains personal data |
| `EmailOutbox` (`FAILED`) | 365 days | Diagnosis needs longer |
| `AuditLog` | **never** | The whole point of it |

Complaints, doubts and answers are **not** on retention timers. They are the record of the
institution's own conduct, and quietly deleting a complaint after a year is the failure mode a
complaints system must not have.

### Config

| Var | Default |
|---|---|
| `DPDP_POLICY_VERSION` | `2026-09-21` |
| `RETENTION_NOTIFICATION_DAYS` | `180` |
| `RETENTION_DOUBT_VIEW_DAYS` | `90` |
| `RETENTION_EMAIL_SENT_DAYS` | `90` |
| `RETENTION_EMAIL_FAILED_DAYS` | `365` |
| `RETENTION_ENABLED` | `true` |

## Acceptance criteria

1. Recording consent writes a row with the policy version and purposes shown.
2. Withdrawing consent writes a second row rather than editing the first.
3. Withdrawal does not erase the account.
4. `GET /api/me/data-export` returns the caller's profile, content and consent history.
5. The export never contains a password hash, face template, token hash or challenge nonce.
6. The export states whether a face template exists.
7. A user can only export their own data.
8. Erasure replaces name, email and `userID` with tombstone values.
9. Erasure deletes the face template.
10. Erasure clears phone, address, guardian name and guardian phone.
11. Erasure keeps doubts, answers and complaints.
12. Erasure deletes notifications, bookmarks, views, upvotes, refresh tokens and face challenges.
13. Erasure deletes queued and sent email addressed to that user.
14. Erasure leaves `AuditLog` rows intact.
15. Erasure writes an audit entry.
16. An erased account cannot log in.
17. Erasure is idempotent — a second call changes nothing further.
18. Retention deletes notifications past the limit and keeps newer ones.
19. Retention never deletes complaints, doubts, answers or audit rows.
20. With `RETENTION_ENABLED=false` the sweep returns zeroes without querying.

## Test plan

- **Unit:** the erasure plan (what is cleared, what is kept, what is deleted); export redaction;
  consent record shape; retention cutoffs per table; disabled sweep.
- **Integration:** export and erasure endpoints across roles; export isolation between users.
- **Manual:** erase a seeded throwaway account, confirm its doubts survive with a tombstone
  author and its audit entries remain.

## Implementation notes 2026-09-21

Built, migration applied. 44 tests (`dataRights.test.ts` 23, `retention.test.ts` 6, plus
three authz matrix rows); 591 backend tests total.

**A test of mine was a false positive and I had to fix the test, not the code.** The
export assertion did `expect(json).not.toContain("password")` — which failed on the
export's own `notIncluded: ["password hash", ...]` disclosure list. It says the word
precisely *because* the value is absent. The assertion now matches JSON keys
(`"password":`) and the ciphertext itself.

An explicit `erasedAt` check was added at login. Erasure already replaces the password
with a non-bcrypt string, so `bcrypt.compare` fails anyway — but relying on that is
relying on an implementation detail of how the tombstone happens to be written.

`/api/me/erase` requires the literal body `{ "confirm": "ERASE MY DATA" }`, and the
audit entry is written **before** the erasure runs, while the actor still has a name.
Writing it after would record a tombstone erasing itself.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Erasure destroys other students' content | Medium without care | High | Anonymise, never cascade-delete; criterion 11 |
| Export leaks a credential | Medium | High | Explicit allow-list per table; criterion 5 |
| Retention deletes a complaint | Low | High | Complaints are not on any timer; criterion 19 |
| Erased user's data lingers in the audit log | Certain | Medium | Deliberate and documented; the data there is minimal |
| Minors' data processed without valid consent | **Unknown** | **High** | Cannot be assessed — no date of birth exists. Flagged, not solved |
| Someone erases an account by mistake | Low | High | Requires the account's own session; audited; tombstone is reversible-ish only via backup |

## Rollback

Revert the code. The migration adds one table and two nullable `User` columns and is additive.

**Erasure is not reversible.** Once a template is deleted and identifiers are overwritten, only a
database backup restores them. That is the intended behaviour of an erasure feature, and it is
the reason the endpoint requires the account's own authenticated session.

## Open questions

1. **Minors.** There is no date of birth in the schema, so the system cannot identify who needs
   verifiable parental consent — while storing guardian contact details for everyone, which
   suggests someone expected minors. Adding a DOB field is trivial; deciding what to do with it
   is a legal call this spec cannot make.
2. Should CC-61 stop recording IP addresses? It is the most sensitive field that survives
   erasure, and the audit log works without it.
3. Retention on resolved complaints after, say, three years? Argued against here, but a real
   retention policy eventually has to say something about them.
4. Data residency: the database is in Singapore. Worth a documented decision.
