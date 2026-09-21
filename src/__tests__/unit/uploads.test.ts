/**
 * CC-02: who may read a given attachment.
 *
 * The authz matrix covers "which roles reach the route". This file covers the
 * harder question the route delegates: whether *this* caller may see *this*
 * file. Complaint evidence is the case that matters — it can show an
 * identifiable person, and it must not be readable by an unrelated student.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Runs before the module graph is evaluated, so config/env.js sees these and
// STORAGE_ENABLED is true for this file. Without them the routes short-circuit
// to 503 and none of the authorization logic below would be reached.
vi.hoisted(() => {
  process.env.SUPABASE_URL = "http://127.0.0.1:1";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

const storage = vi.hoisted(() => ({
  STORAGE_BUCKET: "test-bucket",
  createSignedUpload: vi.fn(),
  createSignedDownload: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

vi.mock("../../services/storage/supabaseStorage.js", () => storage);

import request from "supertest";
import app from "../../app.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import { prismaMock, resetMockState, setMockUser } from "../helpers/prismaMock.js";

/**
 * The mock is a Proxy that materialises a model on first access, which its
 * index signature cannot express. This narrows one model's method back to a
 * plain vi.fn so `mockResolvedValueOnce` accepts a row shape.
 */
const stub = (model: string, method: string): ReturnType<typeof vi.fn> =>
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[
    model
  ]![method]!;

const attachmentFindUnique = () => stub("attachment", "findUnique");
const complaintFindUnique = () => stub("complaint", "findUnique");

const OWNER = "student-owner";

const attachment = (over: Record<string, unknown> = {}) => ({
  id: "att-1",
  storagePath: "COMPLAINT/complaint-1/att-1.jpg",
  bucket: "test-bucket",
  mimeType: "image/jpeg",
  sizeBytes: 2048,
  originalName: "chair.jpg",
  status: "ATTACHED",
  entityType: "COMPLAINT",
  entityId: "complaint-1",
  uploadedById: OWNER,
  createdAt: new Date(),
  confirmedAt: new Date(),
  ...over,
});

/** Sign in as a role, optionally pinning the user id. */
const as = (role: Parameters<typeof userForRole>[0], id?: string) => {
  const user = id ? { ...userForRole(role), id } : userForRole(role);
  setMockUser(user);
  return bearerFor(user);
};

const getAttachment = (auth: [string, string]) =>
  request(app).get("/api/attachments/att-1").set(...auth);

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
  storage.createSignedDownload.mockResolvedValue({
    url: "https://signed.example/download",
    expiresInSeconds: 300,
  });
});

describe("GET /api/attachments/:id", () => {
  it("404s for an attachment that does not exist", async () => {
    attachmentFindUnique().mockResolvedValueOnce(null);

    const res = await getAttachment(as("STUDENT"));

    expect(res.status).toBe(404);
  });

  it("lets the student who raised the complaint read its evidence", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());
    complaintFindUnique().mockResolvedValueOnce({
      raisedById: OWNER,
      assignedToId: null,
    });

    const res = await getAttachment(as("STUDENT", OWNER));

    expect(res.status).toBe(200);
    expect(res.body.url).toBe("https://signed.example/download");
  });

  it("refuses an unrelated student", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());
    complaintFindUnique().mockResolvedValueOnce({
      raisedById: OWNER,
      assignedToId: null,
    });

    const res = await getAttachment(as("STUDENT", "someone-else"));

    expect(res.status).toBe(403);
    expect(storage.createSignedDownload).not.toHaveBeenCalled();
  });

  it("lets the assigned handler read it", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());
    complaintFindUnique().mockResolvedValueOnce({
      raisedById: OWNER,
      assignedToId: "faculty-7",
    });

    const res = await getAttachment(as("FACULTY", "faculty-7"));

    expect(res.status).toBe(200);
  });

  it("refuses faculty who are not assigned to the complaint", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());
    complaintFindUnique().mockResolvedValueOnce({
      raisedById: OWNER,
      assignedToId: "faculty-7",
    });

    const res = await getAttachment(as("FACULTY", "faculty-other"));

    expect(res.status).toBe(403);
  });

  it("lets an admin read any complaint evidence", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());

    const res = await getAttachment(as("ADMIN"));

    expect(res.status).toBe(200);
    // Admins short-circuit, so the parent is never looked up.
    expect(complaintFindUnique()).not.toHaveBeenCalled();
  });

  it("refuses when the parent complaint has been deleted", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());
    complaintFindUnique().mockResolvedValueOnce(null);

    const res = await getAttachment(as("STUDENT", OWNER));

    expect(res.status).toBe(403);
  });

  it("treats resolution proof with the same rules as the complaint", async () => {
    attachmentFindUnique().mockResolvedValueOnce(
      attachment({ entityType: "COMPLAINT_RESOLUTION" }),
    );
    complaintFindUnique().mockResolvedValueOnce({
      raisedById: OWNER,
      assignedToId: null,
    });

    const res = await getAttachment(as("STUDENT", "unrelated"));

    expect(res.status).toBe(403);
  });

  it("lets any authenticated member read a doubt attachment", async () => {
    attachmentFindUnique().mockResolvedValueOnce(
      attachment({ entityType: "DOUBT", entityId: "doubt-1" }),
    );

    const res = await getAttachment(as("STUDENT", "any-student"));

    expect(res.status).toBe(200);
  });

  it("hides a pending attachment from everyone but its uploader", async () => {
    attachmentFindUnique().mockResolvedValueOnce(
      attachment({ status: "PENDING", entityId: null }),
    );

    const res = await getAttachment(as("STUDENT", "someone-else"));

    expect(res.status).toBe(403);
  });

  it("lets the uploader read their own pending attachment", async () => {
    attachmentFindUnique().mockResolvedValueOnce(
      attachment({ status: "PENDING", entityId: null }),
    );

    const res = await getAttachment(as("STUDENT", OWNER));

    expect(res.status).toBe(200);
  });

  it("refuses an attached row that somehow has no parent recorded", async () => {
    attachmentFindUnique().mockResolvedValueOnce(
      attachment({ entityId: null }),
    );

    const res = await getAttachment(as("STUDENT", OWNER));

    expect(res.status).toBe(403);
  });

  it("asks storage to serve the file as a download, not inline", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());

    await getAttachment(as("ADMIN"));

    expect(storage.createSignedDownload).toHaveBeenCalledWith(
      "COMPLAINT/complaint-1/att-1.jpg",
      "chair.jpg",
    );
  });

  it("never exposes the storage path to the caller", async () => {
    attachmentFindUnique().mockResolvedValueOnce(attachment());

    const res = await getAttachment(as("ADMIN"));

    expect(JSON.stringify(res.body)).not.toContain("COMPLAINT/complaint-1");
  });
});
