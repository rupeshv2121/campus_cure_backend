/**
 * CC-02 with no storage credentials configured.
 *
 * This is the default state of a fresh checkout, and — while the Supabase
 * bucket is unavailable — of the real deployment too. The requirement is that
 * the absence is contained: uploads report 503, every other feature is
 * untouched, and nothing queries the `Attachment` table, which may not have
 * been migrated yet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import request from "supertest";
import app from "../../app.js";
import { STORAGE_ENABLED } from "../../config/env.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import { prismaMock, resetMockState, setMockUser } from "../helpers/prismaMock.js";
import {
  listForEntities,
  listForEntity,
  sweepAttachments,
} from "../../services/storage/attachments.js";

const asStudent = () => {
  const user = userForRole("STUDENT");
  setMockUser(user);
  return bearerFor(user);
};

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
});

describe("storage not configured", () => {
  it("reports itself disabled rather than refusing to start", () => {
    expect(STORAGE_ENABLED).toBe(false);
  });

  it("answers 503 when signing an upload", async () => {
    const res = await request(app)
      .post("/api/uploads/sign")
      .set(...asStudent())
      .send({
        entityType: "COMPLAINT",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        originalName: "chair.jpg",
      });

    expect(res.status).toBe(503);
  });

  it("answers 503 when fetching an attachment, without querying for it", async () => {
    const res = await request(app)
      .get("/api/attachments/whatever")
      .set(...asStudent());

    expect(res.status).toBe(503);
    // The table may not exist yet; touching it would be a 500, not a 503.
    expect(prismaMock.attachment!.findUnique).not.toHaveBeenCalled();
  });

  it("still requires authentication", async () => {
    const res = await request(app).post("/api/uploads/sign").send({});
    expect(res.status).toBe(401);
  });

  it("returns no attachments for an entity without querying the table", async () => {
    await expect(listForEntity("COMPLAINT", "complaint-1")).resolves.toEqual([]);
    await expect(
      listForEntities("COMPLAINT", ["complaint-1", "complaint-2"]),
    ).resolves.toEqual(new Map());

    expect(prismaMock.attachment!.findMany).not.toHaveBeenCalled();
  });

  it("makes the nightly sweep a no-op", async () => {
    await expect(sweepAttachments()).resolves.toEqual({
      pendingRemoved: 0,
      orphansRemoved: 0,
    });

    expect(prismaMock.attachment!.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attachment!.deleteMany).not.toHaveBeenCalled();
  });
});
