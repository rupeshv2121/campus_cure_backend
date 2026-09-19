# CC-01c: Privileged role escalation via public registration

| | |
|---|---|
| **Status** | Shipped 2026-09-19 |
| **Phase** | 0 |
| **Severity** | **Critical** — unauthenticated privilege escalation to SUPER_ADMIN |
| **Branch** | backend `feat/CC-04-test-harness`, frontend `feat/CC-01c-privileged-roles` |
| **Repos** | both |
| **Depends on** | CC-01 |
| **Blocks** | nothing |
| **Found** | 2026-09-19, while enumerating routes for the CC-04 authorization matrix |

## Problem

Anyone on the internet could obtain a `SUPER_ADMIN` account and sign straight in.

Four separately-reasonable decisions combined into a complete escalation chain:

1. **`POST /api/auth/register` is public and took `role` directly from the request body**, with a
   whitelist that explicitly included the two privileged roles
   (`authController.ts`, pre-fix):

   ```ts
   if (!["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"].includes(role)) {
     res.status(400).json({ error: "Invalid role" });
   }
   ```

2. The new account is created `approvalStatus: PENDING`, `isActive: false` — the intended gate.
3. **But the approval check at login is commented out** — `// Temporarily allow login for pending
   users`. A `PENDING` account therefore authenticates normally, and `login()` sets
   `isActive: true` itself before issuing the token.
4. `authorize(Role.SUPER_ADMIN)` trusts `req.user.role`, which comes from that token.

Net effect: `POST /register` with `role: "SUPER_ADMIN"`, then `POST /login`, and the caller holds a
valid super-admin session with access to every user record, every complaint, and system settings.
`POST /api/admin/` is also public, letting the same caller set their own `manageUsers` /
`manageComplaints` permissions on the way through.

### Evidence it was live

The production database contained accounts that were `PENDING` yet had `isActive: true` — 4 students,
2 faculty, 1 admin. `isActive` is only set by a successful login, so unapproved accounts were
demonstrably authenticating.

It was then demonstrated accidentally and conclusively: during verification, three accounts (two of
them `SUPER_ADMIN`) were created against production through this exact path in a single request each.
They were removed the same day — see *Incident* below.

## Goal

A privileged role cannot be self-assigned. Creating an `ADMIN` or `SUPER_ADMIN` requires an existing,
active super admin.

## Non-goals / Out of scope

- **Re-enabling the approval gate at login.** Deliberately left as-is by team decision: turning it on
  would lock out the seven pending-but-active accounts currently used for development. Tracked
  separately — see *Residual risk*.
- Refresh tokens and revocation — CC-01b.
- `POST /api/admin/` (createAdminProfile) is still public — see *Residual risk*.
- A UI for super admins to create administrators. The API supports it; no screen was built.

## Design

### Backend

`register()` splits roles into two sets:

```ts
const SELF_SERVICE_ROLES: Role[] = [Role.STUDENT, Role.FACULTY];
const PRIVILEGED_ROLES: Role[]   = [Role.ADMIN, Role.SUPER_ADMIN];
```

An unknown role still returns `400`. A privileged role requires the request to carry a bearer token
belonging to an **active** `SUPER_ADMIN`, else `403`.

The check consults the database rather than trusting the token claim alone, so that a deactivated
super admin cannot mint new administrators:

```ts
const isRequestFromActiveSuperAdmin = async (req: Request): Promise<boolean> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
    if (!decoded.id) return false;
    const requester = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, isActive: true },
    });
    return !!requester && requester.isActive && requester.role === Role.SUPER_ADMIN;
  } catch {
    return false;
  }
};
```

### Frontend

`RegisterPage.tsx` offered **Admin** in its role dropdown, which now returns `403`. That option is
commented out alongside the already-disabled Super Admin option, leaving Student and Faculty.

## Acceptance criteria

1. Unauthenticated `POST /api/auth/register` with `role: "SUPER_ADMIN"` returns `403`. ✅
2. Same for `role: "ADMIN"`. ✅
3. A refused privileged registration creates **no** user record. ✅
4. A token signed with the wrong secret does not authorise a privileged role. ✅
5. An `ADMIN` token cannot create a `SUPER_ADMIN`. ✅
6. A deactivated super admin's token cannot create an `ADMIN`. ✅
7. An active `SUPER_ADMIN` can create an `ADMIN`. ✅
8. An unknown role still returns `400`, not `403`. ✅
9. Self-service registration as `STUDENT` still succeeds. ✅
10. The register page no longer offers Admin. ✅

All ten are covered by `src/__tests__/regression/security.test.ts` (CC-04) and pass.

## Test plan

Covered by the CC-04 suite with a mocked Prisma client — **no live testing against production.**
Verified negatively as well: replacing the guard condition with `if (false)` turns six of these tests
red, confirming they actually detect the regression.

## Incident — 2026-09-19

While verifying the fix, a stale `tsx` server from an earlier test was still holding port 5000. The
new server never bound the port, so requests reached the **pre-fix** code, and the assumption that
"rejection paths create no records" did not hold.

Three accounts were created in the production database (`probe-sa@example.com` SUPER_ADMIN,
`probe-ad@example.com` ADMIN, `probe-f@example.com` SUPER_ADMIN), with a password that had appeared
in a chat transcript. They were deleted the same day via a scoped, transactional script; admin
account counts were confirmed to match the pre-incident state exactly (ADMIN 3 pending / 1 approved,
SUPER_ADMIN 1 pending / 2 approved, 25 users total).

**Process changes adopted:**

- Security fixes are verified through the mocked test suite, never by firing requests at production.
- Before trusting any local server result, confirm the process that owns the port is the one just
  started. `pkill` silently fails on Windows.

## Residual risk

1. **The approval gate is still disabled at login.** Any registered student or faculty account can
   sign in without approval. That is now the only thing standing between an attacker and a
   `STUDENT`/`FACULTY` session — acceptable, since those are self-service roles anyway, but it should
   be re-enabled before any real deployment.
2. **`POST /api/admin/` remains public.** It sets permissions on an existing `PENDING` admin profile.
   Exploiting it requires knowing a pending admin's UUID, so practical risk is low, but it should
   require authentication. **Recommended follow-up: CC-01d.**
3. There is no UI path for a super admin to create administrators, so admin creation currently needs
   a manual API call.

## Rollback

Revert the two commits. Doing so reopens the escalation — do not roll back without replacing the
control.
