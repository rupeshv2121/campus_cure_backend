/**
 * Regression tests for the security fixes in CC-01 and CC-01c.
 *
 * Each of these guards a hole that was open in production. They exist because
 * every one of them is a plausible accidental re-introduction — especially the
 * password logging, which is one stray debug line away from returning.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../app.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import {
  resetMockState,
  setLoginUser,
  setMockUser,
} from "../helpers/prismaMock.js";

beforeEach(() => {
  resetMockState();
});

/* ------------------------------------------------------------------ *
 * CC-01c — privileged role escalation
 *
 * `POST /api/auth/register` took `role` straight from the request body and
 * accepted "SUPER_ADMIN". With the approval gate disabled at login, anyone
 * could register as a super admin and sign straight in.
 * ------------------------------------------------------------------ */
describe("CC-01c: privileged roles cannot be self-assigned", () => {
  const body = (role: string) => ({
    name: "Probe",
    email: `probe-${role.toLowerCase()}@test.local`,
    password: "Passw0rd!",
    role,
    userID: `PROBE_${role}`,
  });

  it.each(["SUPER_ADMIN", "ADMIN"])(
    "rejects an unauthenticated request to register as %s",
    async (role) => {
      const res = await request(app).post("/api/auth/register").send(body(role));
      expect(res.status).toBe(403);
    },
  );

  it("does not create an account when a privileged role is refused", async () => {
    const { prismaMock } = await import("../helpers/prismaMock.js");
    await request(app).post("/api/auth/register").send(body("SUPER_ADMIN"));
    expect(prismaMock.user!.create).not.toHaveBeenCalled();
  });

  it("rejects a privileged role when the bearer token is forged", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign(
      { id: "x", role: "SUPER_ADMIN" },
      "not-the-real-secret",
    );
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${forged}`)
      .send(body("SUPER_ADMIN"));
    expect(res.status).toBe(403);
  });

  it("rejects a privileged role when the requester is only an ADMIN", async () => {
    const admin = userForRole("ADMIN");
    setMockUser(admin);
    const res = await request(app)
      .post("/api/auth/register")
      .set(...bearerFor(admin))
      .send(body("SUPER_ADMIN"));
    expect(res.status).toBe(403);
  });

  it("rejects a privileged role when the requesting super admin is deactivated", async () => {
    const superAdmin = { ...userForRole("SUPER_ADMIN"), isActive: false };
    setMockUser(superAdmin);
    const res = await request(app)
      .post("/api/auth/register")
      .set(...bearerFor(superAdmin))
      .send(body("ADMIN"));
    expect(res.status).toBe(403);
  });

  it("allows an active SUPER_ADMIN to create an ADMIN", async () => {
    const superAdmin = userForRole("SUPER_ADMIN");
    setMockUser(superAdmin);
    const res = await request(app)
      .post("/api/auth/register")
      .set(...bearerFor(superAdmin))
      .send(body("ADMIN"));
    expect(res.status).not.toBe(403);
  });

  it("still rejects an unknown role with 400, not 403", async () => {
    const res = await request(app).post("/api/auth/register").send(body("WIZARD"));
    expect(res.status).toBe(400);
  });

  it("allows self-service registration as STUDENT", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Student",
      email: "selfserve-student@test.local",
      password: "Passw0rd!",
      role: "STUDENT",
      userID: "SELF_STU",
    });
    expect(res.status).not.toBe(403);
  });
});

/* ------------------------------------------------------------------ *
 * CC-01 — credential handling
 * ------------------------------------------------------------------ */
describe("CC-01: login does not leak information", () => {
  const PASSWORD = "CorrectHorse1!";

  const existingUser = async () => ({
    ...userForRole("STUDENT"),
    email: "real-user@test.local",
    password: await bcrypt.hash(PASSWORD, 4), // low cost: tests, not production
  });

  it("returns an identical response for an unknown email and a wrong password", async () => {
    setLoginUser(null);
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "no-such-account@test.local", password: "whatever" });

    setLoginUser(await existingUser());
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "real-user@test.local", password: "definitely-wrong" });

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    // Byte-identical: any difference is a user-enumeration oracle.
    expect(unknown.body).toEqual(wrongPassword.body);
  });

  it("never writes the submitted password to the log", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    setLoginUser(await existingUser());
    await request(app)
      .post("/api/auth/login")
      .send({ email: "real-user@test.local", password: PASSWORD });

    const logged = [...spy.mock.calls, ...errSpy.mock.calls]
      .flat()
      .map((arg) => {
        try {
          return typeof arg === "string" ? arg : JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");

    expect(logged).not.toContain(PASSWORD);

    spy.mockRestore();
    errSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ *
 * CC-01 — transport hardening
 * ------------------------------------------------------------------ */
describe("CC-01: security headers", () => {
  it("sets the headers helmet is mounted for", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("does not advertise the framework", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * CC-01 — rate limiting
 * ------------------------------------------------------------------ */
describe("CC-01: login rate limiting", () => {
  it("blocks the 6th failed attempt and leaves other accounts unaffected", async () => {
    setLoginUser(null);
    const target = "ratelimit-target@test.local";

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: target, password: "wrong" });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);

    // Keyed per account, so a different user is not collaterally locked out.
    const other = await request(app)
      .post("/api/auth/login")
      .send({ email: "bystander@test.local", password: "wrong" });
    expect(other.status).toBe(401);
  });
});
