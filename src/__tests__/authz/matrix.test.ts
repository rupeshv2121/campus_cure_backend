/**
 * The authorization matrix.
 *
 * For each representative route, assert what every role — and an anonymous
 * caller — is allowed to do. This is the test that answers "can a student reach
 * an admin endpoint?" without reading 5,800 lines by hand.
 *
 * Prisma is mocked, because authorization is decided by middleware before any
 * query runs. For a permitted role we assert only that the request was *not*
 * rejected as unauthenticated or forbidden — the handler may still fail against
 * a stub database, and that is not what this file is testing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import request from "supertest";
import app from "../../app.js";
import { ROLES, bearerFor, userForRole, type TestRole } from "../helpers/auth.js";
import { resetMockState, setMockUser } from "../helpers/prismaMock.js";

const UNAUTHENTICATED = 401;
const FORBIDDEN = 403;

interface RouteCase {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  /** Roles the route is declared to permit. */
  allow: TestRole[];
}

/**
 * One route per distinct guard combination in the codebase. Kept deliberately
 * small: the global limiter allows 100 requests/minute, and the point is to
 * cover each *guard*, not each of the 75 routes.
 */
const ROUTES: RouteCase[] = [
  { method: "get", path: "/api/students/me", allow: ["STUDENT"] },
  // CC-14: intake parsing costs provider quota, so it is students only.
  { method: "post", path: "/api/students/complaints/parse", allow: ["STUDENT"] },
  {
    method: "get",
    path: "/api/students/settings/posting",
    allow: ["STUDENT", "FACULTY"],
  },
  { method: "get", path: "/api/faculty/me", allow: ["FACULTY"] },
  // CC-12: AI answer drafts must never be reachable by a student or an admin.
  { method: "get", path: "/api/faculty/doubts/x/draft", allow: ["FACULTY"] },
  {
    method: "post",
    path: "/api/faculty/doubts/x/draft/approve",
    allow: ["FACULTY"],
  },
  {
    method: "post",
    path: "/api/faculty/doubts/x/draft/reject",
    allow: ["FACULTY"],
  },
  {
    method: "get",
    path: "/api/admin/dashboard",
    allow: ["ADMIN", "SUPER_ADMIN"],
  },
  { method: "get", path: "/api/admin/super/stats", allow: ["SUPER_ADMIN"] },
  // CC-13: AI-backed admin view, so worth asserting explicitly rather than
  // relying on another route in the same guard group.
  {
    method: "get",
    path: "/api/admin/complaints/duplicates",
    allow: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    method: "get",
    path: "/api/notifications/",
    allow: ["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"],
  },
  // CC-15: the chatbot exposes student-scoped tools, so only students reach it.
  { method: "post", path: "/api/chat/", allow: ["STUDENT"] },
  // CC-61: the audit trail is SUPER_ADMIN only. Most entries are about ADMIN
  // behaviour, and a trail the audited party can read is one they can learn to
  // work around - so ADMIN is excluded deliberately, not by oversight.
  {
    method: "get",
    path: "/api/admin/audit-log",
    allow: ["SUPER_ADMIN"],
  },
  // CC-20/CC-21: the doubt community is students and faculty, matching the
  // roles already granted on upvoteDoubt. Admins do not take part in it.
  {
    method: "get",
    path: "/api/students/doubts/tags",
    allow: ["STUDENT", "FACULTY"],
  },
  {
    method: "get",
    path: "/api/students/doubts/bookmarked",
    allow: ["STUDENT", "FACULTY"],
  },
  {
    method: "post",
    path: "/api/students/doubts/x/bookmark",
    allow: ["STUDENT", "FACULTY"],
  },
  {
    method: "delete",
    path: "/api/students/doubts/x/bookmark",
    allow: ["STUDENT", "FACULTY"],
  },
  // CC-02: every role uploads something — students file evidence, faculty and
  // admins attach resolution proof. What an upload may be bound to is decided
  // at confirmation by the parent entity, not by this guard.
  {
    method: "post",
    path: "/api/uploads/sign",
    allow: ["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"],
  },
  // CC-02: reachable by any authenticated role; whether a *specific* file is
  // readable is delegated to its parent entity and covered in uploads.test.ts.
  {
    method: "get",
    path: "/api/attachments/some-id",
    allow: ["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"],
  },
];

beforeEach(() => {
  resetMockState();
});

describe("authorization matrix", () => {
  describe("anonymous callers", () => {
    it.each(ROUTES)(
      "$method $path rejects an unauthenticated request",
      async ({ method, path }) => {
        const res = await request(app)[method](path);
        expect(res.status).toBe(UNAUTHENTICATED);
      },
    );

    it("rejects a token signed with the wrong secret", async () => {
      const jwt = (await import("jsonwebtoken")).default;
      const forged = jwt.sign(
        { id: "whoever", role: "SUPER_ADMIN" },
        "not-the-real-secret",
      );
      const res = await request(app)
        .get("/api/admin/super/stats")
        .set("Authorization", `Bearer ${forged}`);
      expect(res.status).toBe(UNAUTHENTICATED);
    });
  });

  describe("role permissions", () => {
    for (const route of ROUTES) {
      for (const role of ROLES) {
        const permitted = route.allow.includes(role);

        it(`${role} ${permitted ? "may" : "may NOT"} ${route.method.toUpperCase()} ${route.path}`, async () => {
          const user = userForRole(role);
          setMockUser(user);

          const res = await request(app)
            [route.method](route.path)
            .set(...bearerFor(user));

          if (permitted) {
            expect(res.status).not.toBe(FORBIDDEN);
            expect(res.status).not.toBe(UNAUTHENTICATED);
          } else {
            expect(res.status).toBe(FORBIDDEN);
          }
        });
      }
    }
  });

  describe("deactivated accounts", () => {
    it("rejects a valid token when the account is no longer active", async () => {
      const user = { ...userForRole("ADMIN"), isActive: false };
      setMockUser(user);

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set(...bearerFor(user));

      expect(res.status).toBe(UNAUTHENTICATED);
    });

    it("rejects a valid token when the account no longer exists", async () => {
      const user = userForRole("ADMIN");
      setMockUser(null); // token is valid, but the row is gone

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set(...bearerFor(user));

      expect(res.status).toBe(UNAUTHENTICATED);
    });
  });
});
