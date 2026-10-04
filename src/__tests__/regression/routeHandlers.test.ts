/**
 * Every route ends in exactly one controller handler.
 *
 * CC-12's merge (649cfe3) pasted an import list into three routes. It
 * compiled, the authorization matrix still passed - and on
 * PUT /faculty/answers/:id/moderate the AI-draft approval handler ran first
 * and refused every request, so faculty could not moderate answers at all.
 * Found during CC-72 stage 2. This walks the live router so it cannot recur.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import request from "supertest";
import app from "../../app.js";
import * as admin from "../../controllers/adminController.js";
import * as auth from "../../controllers/authController.js";
import * as faculty from "../../controllers/facultyController.js";
import * as facultyStats from "../../controllers/facultyStatsController.js";
import * as mfa from "../../controllers/mfaController.js";
import * as student from "../../controllers/studentController.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import { setMockUser } from "../helpers/prismaMock.js";

const controllerHandlers = new Set<unknown>(
  [admin, auth, faculty, facultyStats, mfa, student].flatMap((module) =>
    Object.values(module).filter((value) => typeof value === "function"),
  ),
);

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
  handle?: { stack?: Layer[] };
}

/** Every route in the app, with how many controller handlers it runs. */
const collect = (stack: Layer[], out: Array<{ route: string; count: number }> = []) => {
  for (const layer of stack) {
    if (layer.route) {
      const count = layer.route.stack.filter((l) => controllerHandlers.has(l.handle)).length;
      out.push({ route: `${Object.keys(layer.route.methods).join(",").toUpperCase()} ${layer.route.path}`, count });
    } else if (layer.handle?.stack) {
      collect(layer.handle.stack, out);
    }
  }
  return out;
};

describe("route table", () => {
  const routes = collect(
    ((app as unknown as { router?: { stack: Layer[] }; _router?: { stack: Layer[] } }).router ??
      (app as unknown as { _router: { stack: Layer[] } })._router).stack,
  );

  it("finds the routes (guards against the walk silently seeing nothing)", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("never runs more than one controller handler on a route", () => {
    const doubled = routes.filter((r) => r.count > 1);
    expect(doubled, JSON.stringify(doubled)).toEqual([]);
  });

  it("reaches moderateAnswer on the moderation route", async () => {
    const faculty = userForRole("FACULTY");
    setMockUser(faculty);
    const res = await request(app)
      .put("/api/faculty/answers/x/moderate")
      .set(...bearerFor(faculty))
      .send({ approvalStatus: "MAYBE" });

    // moderateAnswer's own validation message, not the draft handler's.
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("approvalStatus must be APPROVED or REJECTED");
  });
});
