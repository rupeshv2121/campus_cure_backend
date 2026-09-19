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
  {
    method: "get",
    path: "/api/students/settings/posting",
    allow: ["STUDENT", "FACULTY"],
  },
  { method: "get", path: "/api/faculty/me", allow: ["FACULTY"] },
  {
    method: "get",
    path: "/api/admin/dashboard",
    allow: ["ADMIN", "SUPER_ADMIN"],
  },
  { method: "get", path: "/api/admin/super/stats", allow: ["SUPER_ADMIN"] },
  {
    method: "get",
    path: "/api/notifications/",
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
