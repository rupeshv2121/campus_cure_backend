# CC-61: Audit log

| | |
|---|---|
| **Status** | **Implemented 2026-09-21** — migration applied, trigger verified |
| **Phase** | 6 |
| **Branch** | `feat/CC-61-audit-log` |
| **Repos** | backend |
| **Depends on** | CC-04 (shipped) |
| **Blocks** | CC-64 |
| **Estimate** | 2 days |
| **Shipped** | 2026-09-21 |

## Problem

Nothing in CampusCure records who did what.

An admin can approve an account, grant another admin `manageUsers`, reassign a complaint away
from the person who was fixing it, change the categories every student may file under, or clear
someone's biometric template — and the only trace is the new value. `adminController.ts` has
twenty-six exported handlers and not one of them writes a record of having run.

Three things made this worse in the last week:

1. **CC-31 changes complaint status with no human involved.** A complaint can now move to
   `ESCALATED_TO_SUPERADMIN` overnight. "Who escalated this?" currently has no answer at all,
   because nobody did.
2. **CC-60 introduced encrypted biometric templates** and an endpoint that deletes them. Deleting
   regulated personal data with no record of who asked or when is the specific thing a data
   protection regime cares about.
3. **`assignmentHistory` and `rejectionHistory` already exist** as `Json` columns on `Complaint`
   — so the project has already discovered it needs this, and solved it once, narrowly, for one
   entity, in a shape nothing can query across.

CC-64 (DPDP) cannot be built on top of nothing. "Show me everything done to this person's data"
needs a table.

## Goal

Every privileged action leaves an immutable, queryable record of who did it, to what, and when —
including the actions the system takes on its own. A super admin can read that record; nobody,
including an admin, can alter it through the application.

## Non-goals / Out of scope

- **Auditing reads.** Who *viewed* a complaint is a much larger volume of writes for much less
  value. Recorded as an open question, not built.
- **Auditing ordinary user actions.** A student posting a doubt is not a privileged action. This
  is a trail of power being exercised, not an activity feed.
- **Retention and deletion policy.** CC-64 owns it. An audit log that deletes itself on a
  schedule nobody has agreed is worse than one that grows.
- **A frontend viewer.** The roadmap scopes CC-61 to the backend. The read endpoint is built so a
  later UI needs no migration.
- **Tamper-evidence via hash chaining.** Each row signed with the hash of the previous one would
  detect edits made *around* the application. Genuinely useful, genuinely more than two days, and
  pointless until the operational side below is solved. Open question.
- **Migrating `assignmentHistory` / `rejectionHistory`.** They keep working; new events are
  additionally recorded here. Rewriting them is churn with no reader asking for it.

## Design

### What immutability actually means here

The application never updates or deletes an audit row — there is no code path that can. That is
convention, and convention is not a control, so the migration also installs a database trigger:

```sql
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
```

`UPDATE` and `DELETE` on the table raise an exception. That is a real control: it stops the
application, an ORM mistake, and a hand-written `UPDATE` in a console.

**It does not stop a database superuser**, who can drop the trigger. Real immutability means
append-only storage the application cannot reach — shipping rows off-box, or WORM storage. This
is honest about being tamper-*resistant*, not tamper-proof, and is the strongest control
available without new infrastructure.

### No foreign key on the actor

```prisma
actorId String?   // deliberately NOT a relation
```

A `User` relation with `onDelete: Cascade` would let anyone erase their own history by deleting
their account — the exact thing an audit log exists to prevent. `SetNull` would be better but
still loses who it was. So the id is stored as a plain string alongside a denormalised snapshot
of the actor's role and label at the time.

That snapshot is the point: an audit entry must stay meaningful after the account is gone or its
role has changed. "ADMIN Priya assigned this" is the fact; looking it up later would give today's
answer to a question about the past.

### The system is an actor

CC-31 escalates with nobody logged in, so `actorType` distinguishes `USER` from `SYSTEM`. Without
it, system actions would either be unattributable or be falsely attributed to whoever happened to
trigger the cron.

### Writing a record must not break the action

`recordAudit` never throws. A logging failure is written to the console and swallowed, exactly
like CC-40's email.

There is a real tension here and it is worth naming. For strict compliance the opposite is
correct — no log, no action — and an audit system that silently drops records when the database
hiccups is weaker than one that refuses to proceed. The compromise:

- **Where the caller already has a transaction, the audit row joins it** and commits atomically
  with the action it describes. Assignment and status changes take this path.
- **Everywhere else it is best-effort**, because a failed audit write must not leave an admin
  unable to approve a student.

Which call sites are atomic is visible at the call site, not hidden in the helper.

### Never log a secret

Audit metadata is attacker-interesting by construction. `recordAudit` scrubs any key matching
`password`, `token`, `secret`, `key`, `descriptor`, `nonce` or `hash` before writing, replacing
the value with `[redacted]`.

This matters specifically because of CC-60: an audit entry for "face template cleared" must not
contain the template.

### Schema

```prisma
model AuditLog {
  id          String     @id @default(uuid())
  actorType   AuditActor @default(USER)
  actorId     String?
  actorRole   String?
  actorLabel  String?
  action      String
  targetType  String
  targetId    String?
  summary     String
  metadata    Json?
  ip          String?
  userAgent   String?
  createdAt   DateTime   @default(now())

  @@index([createdAt])
  @@index([actorId, createdAt])
  @@index([targetType, targetId])
  @@index([action, createdAt])
}

enum AuditActor { USER SYSTEM }
```

`action` is a dotted string (`complaint.assign`, `user.approve`, `face.clear`) rather than an
enum. An enum means a migration every time a new action is audited, which is a tax that gets paid
by not auditing the new thing.

### What is audited

Privileged actions only — power being exercised:

| Action | Where |
|---|---|
| `user.approve`, `user.reject` | `approveUser`, `rejectUser` |
| `user.approval_status_change` | `updateUserApprovalStatus` |
| `user.active_toggle` | `toggleUserActiveStatus` |
| `admin.permissions_change` | `updateAdminPermissions` |
| `settings.update` | `updateSuperAdminSettings` |
| `complaint.assign` | `assignComplaint` |
| `complaint.status_change` | `updateComplaintStatus` |
| `complaint.reassign` | `reassignEscalatedComplaint` |
| `complaint.escalate` | CC-31 sweep — **actor is SYSTEM** |
| `face.clear` | `deleteFaceDescriptor` |

`admin.permissions_change` is the highest-value row in the table: it is how an admin becomes a
more powerful admin, and CC-01c exists because that path was once open to the internet.

### Reading it

`GET /api/admin/audit-log` — **SUPER_ADMIN only**. Filters on `action`, `actorId`, `targetType`,
`targetId` and a date range; paginated, newest first, capped at 100 per page.

Admins are deliberately excluded from reading it. Most entries are about admin behaviour, and a
trail the audited party can read is one they can learn to work around.

## Acceptance criteria

1. Approving a user writes one row with `action = "user.approve"`.
2. The row records actor id, role and a label snapshot.
3. A system-originated escalation writes `actorType = "SYSTEM"` and no actor id.
4. Assigning a complaint records both the complaint and the new assignee.
5. A permissions change records what changed.
6. Clearing a face template writes a row and **no descriptor data**.
7. Metadata keys matching password/token/secret/key/descriptor/nonce/hash are redacted.
8. `recordAudit` returns without throwing when the write fails.
9. A failed audit write does not prevent the action succeeding.
10. Passing a transaction makes the audit row commit with the action.
11. `UPDATE` on `AuditLog` raises a database error.
12. `DELETE` on `AuditLog` raises a database error.
13. Deleting a user does not delete their audit rows.
14. `GET /api/admin/audit-log` is 403 for ADMIN, FACULTY and STUDENT.
15. It is 401 unauthenticated.
16. Results are newest first and paginated, capped at 100.
17. Filtering by action and by target works.
18. No response ever includes a redacted value.

## Test plan

- **Unit:** redaction (nested objects, arrays, case-insensitive keys); actor snapshotting;
  SYSTEM actor; never-throws on failure; transaction pass-through.
- **Integration:** the read endpoint across all four roles, added to the authz matrix; filters and
  pagination.
- **Database:** the immutability trigger, exercised against the real database after migrating —
  criteria 11 and 12 cannot be proven against a mock.

## Implementation notes 2026-09-21

Built, migration applied. 21 tests (`auditLog.test.ts` 20 plus an authz matrix row);
547 backend tests total.

**The immutability trigger was verified against the real database**, because criteria 11
and 12 cannot be proven against a mock:

```
insert: OK
UPDATE: blocked -> AuditLog is append-only: UPDATE is not permitted
DELETE: blocked -> AuditLog is append-only: DELETE is not permitted
row survived untampered
foreign keys on AuditLog (expect none): []
```

**The probe row is still there and cannot be removed.** That is the feature working, not
an oversight — there is no application path and no SQL path to delete it, and dropping
the trigger to tidy up would be the exact attack the trigger exists to stop. It is
`id = trigger-probe-*`, `action = user.approve`, `targetId = probe-target`, and it is the
first entry in the log.

`recordAudit` needed `Prisma.DbNull` rather than `undefined` for absent metadata —
with `exactOptionalPropertyTypes` an omitted key is not assignable to a nullable Json
column.

Ten call sites are instrumented, listed under *What is audited*. `complaint.escalate` is
the only one with a `SYSTEM` actor, and it comes from CC-31's nightly sweep.

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Table grows without bound | Certain, slowly | Low | Privileged actions only; retention is CC-64's |
| A secret reaches metadata | Medium | High | Key-based redaction; criterion 6 for the biometric case |
| Audit failure blocks an admin | Low | Medium | Never throws; atomic only where a transaction already exists |
| Superuser edits the log | Low | High | Documented as tamper-resistant, not tamper-proof; hash chaining recorded as an open question |
| Actor snapshot drifts from truth | Low | Low | Intentional — the snapshot *is* the historical fact |

## Rollback

Revert the code and drop the table, the enum and the trigger function. The migration is additive
and nothing references `AuditLog`, so leaving it costs nothing — and dropping it destroys the
only record of privileged actions taken while it was live. Prefer leaving it.

## Open questions

1. Hash-chain each row against the previous one, for tamper *evidence* rather than resistance?
   Cheap to add, only meaningful alongside off-box storage.
2. Should admins read entries about their own actions? Transparency argues yes; the
   working-around-it problem argues no. Currently no.
3. Audit reads of student personal data — guardian phone numbers, addresses? DPDP arguably wants
   it, and the write volume is large. CC-64's call, not this spec's.
