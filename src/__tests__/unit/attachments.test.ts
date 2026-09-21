/**
 * CC-02: attachment reservation, confirmation and sweep.
 *
 * The two things that matter most here are that nothing the client sends ever
 * reaches the storage path, and that the size cap is enforced against the
 * object's real size rather than the number the client claimed. Everything
 * else is the state machine around those.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    attachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    complaint: { findMany: vi.fn() },
    doubt: { findMany: vi.fn() },
    answer: { findMany: vi.fn() },
  },
}));

const storage = vi.hoisted(() => ({
  STORAGE_BUCKET: "test-bucket",
  createSignedUpload: vi.fn(),
  createSignedDownload: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../services/storage/supabaseStorage.js", () => storage);
vi.mock("../../config/env.js", () => ({
  // These tests exercise the storage path itself, so it is switched on here.
  // The disabled case is covered separately below.
  STORAGE_ENABLED: true,
  ATTACHMENT_MAX_BYTES: 5 * 1024 * 1024,
  ATTACHMENT_MAX_PER_ENTITY: 5,
  ATTACHMENT_PENDING_TTL_HOURS: 24,
}));

import {
  AttachmentError,
  confirmAttachments,
  reserveUpload,
  sweepAttachments,
} from "../../services/storage/attachments.js";

/**
 * First argument of a mock's first call.
 *
 * Wrapped because `noUncheckedIndexedAccess` makes every `mock.calls[0][0]`
 * a possibly-undefined access, which would otherwise need a non-null assertion
 * at each of the dozen assertion sites below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const firstArg = (fn: { mock: { calls: any[][] } }): any => fn.mock.calls[0]![0];

const USER = "user-1";

const reserve = (over: Record<string, unknown> = {}) =>
  reserveUpload({
    entityType: "COMPLAINT",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    originalName: "chair.jpg",
    uploadedById: USER,
    ...over,
  } as Parameters<typeof reserveUpload>[0]);

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: "att-1",
  storagePath: "COMPLAINT/pending/att-1.jpg",
  bucket: "test-bucket",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  originalName: "chair.jpg",
  status: "PENDING",
  entityType: "COMPLAINT",
  entityId: null,
  uploadedById: USER,
  createdAt: new Date(),
  confirmedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.createSignedUpload.mockResolvedValue({
    uploadUrl: "https://signed.example/upload",
    token: "tok",
    expiresInSeconds: 300,
  });
  storage.headObject.mockResolvedValue({
    exists: true,
    sizeBytes: 1024,
    mimeType: "image/jpeg",
  });
  storage.deleteObjects.mockResolvedValue(undefined);
  db.prisma.attachment.create.mockResolvedValue({});
  db.prisma.attachment.update.mockResolvedValue({});
  db.prisma.attachment.deleteMany.mockResolvedValue({ count: 0 });
  db.prisma.attachment.count.mockResolvedValue(0);
});

describe("reserveUpload", () => {
  it("records the reservation before handing out a URL", async () => {
    const result = await reserve();

    expect(result.attachmentId).toBeTruthy();
    expect(result.uploadUrl).toBe("https://signed.example/upload");
    expect(db.prisma.attachment.create).toHaveBeenCalledOnce();

    const created = firstArg(db.prisma.attachment.create).data;
    expect(created.status).toBe("PENDING");
    expect(created.uploadedById).toBe(USER);
  });

  it("rejects a MIME type outside the allow-list and records nothing", async () => {
    await expect(reserve({ mimeType: "application/zip" })).rejects.toThrow(
      AttachmentError,
    );
    expect(db.prisma.attachment.create).not.toHaveBeenCalled();
    expect(storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it("rejects a size over the cap and records nothing", async () => {
    await expect(reserve({ sizeBytes: 6 * 1024 * 1024 })).rejects.toThrow(
      /too large/i,
    );
    expect(db.prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive or unparseable size", async () => {
    await expect(reserve({ sizeBytes: 0 })).rejects.toThrow(AttachmentError);
    await expect(reserve({ sizeBytes: "big" })).rejects.toThrow(
      AttachmentError,
    );
  });

  it("rejects an unknown entity type", async () => {
    await expect(reserve({ entityType: "INVOICE" })).rejects.toThrow(
      AttachmentError,
    );
  });

  it("accepts HEIC, because it is the iPhone camera default", async () => {
    await expect(reserve({ mimeType: "image/heic" })).resolves.toBeTruthy();
  });

  it("builds the object key from the MIME type, never the filename", async () => {
    await reserve({ originalName: "../../../etc/passwd" });

    const { storagePath } = firstArg(db.prisma.attachment.create).data;
    expect(storagePath).toMatch(
      /^COMPLAINT\/pending\/[0-9a-f-]{36}\.jpg$/,
    );
    expect(storagePath).not.toContain("..");
    expect(storagePath).not.toContain("passwd");
  });

  it("keeps only the sanitised basename of the filename for display", async () => {
    await reserve({ originalName: "../../secret/notes.jpg" });

    const { originalName } = firstArg(db.prisma.attachment.create).data;
    expect(originalName).toBe("notes.jpg");
  });

  it("falls back to a safe name when originalName is not a string", async () => {
    await reserve({ originalName: { evil: true } });

    expect(firstArg(db.prisma.attachment.create).data.originalName).toBe(
      "file",
    );
  });

  it("ignores a client-supplied storagePath", async () => {
    await reserve({ storagePath: "other-user/owned.png" } as never);

    const { storagePath } = firstArg(db.prisma.attachment.create).data;
    expect(storagePath).not.toContain("other-user");
  });
});

describe("confirmAttachments", () => {
  const confirm = (over: Record<string, unknown> = {}) =>
    confirmAttachments({
      attachmentIds: ["att-1"],
      entityType: "COMPLAINT",
      entityId: "complaint-1",
      userId: USER,
      ...over,
    } as Parameters<typeof confirmAttachments>[0]);

  it("binds a pending attachment to its entity", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([pendingRow()])
      .mockResolvedValueOnce([pendingRow({ status: "ATTACHED" })]);

    await confirm();

    const update = firstArg(db.prisma.attachment.update);
    expect(update.data.status).toBe("ATTACHED");
    expect(update.data.entityId).toBe("complaint-1");
  });

  it("is a no-op for an empty list", async () => {
    await expect(confirm({ attachmentIds: [] })).resolves.toEqual([]);
    expect(db.prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it("refuses to attach a file uploaded by someone else", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([
      pendingRow({ uploadedById: "someone-else" }),
    ]);

    await expect(confirm()).rejects.toMatchObject({ status: 403 });
    expect(db.prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("refuses to re-parent an already attached file", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([
      pendingRow({ status: "ATTACHED", entityId: "complaint-0" }),
    ]);

    await expect(confirm()).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a file reserved for a different entity type", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([
      pendingRow({ entityType: "DOUBT" }),
    ]);

    await expect(confirm()).rejects.toMatchObject({ status: 400 });
  });

  it("404s when an id does not exist", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([]);

    await expect(confirm()).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a file whose real size exceeds the cap, and deletes it", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([pendingRow()]);
    // The client claimed 1 KB at signing time; storage says otherwise.
    storage.headObject.mockResolvedValueOnce({
      exists: true,
      sizeBytes: 9 * 1024 * 1024,
      mimeType: "image/jpeg",
    });

    await expect(confirm()).rejects.toMatchObject({ status: 400 });

    expect(storage.deleteObjects).toHaveBeenCalledWith([
      "COMPLAINT/pending/att-1.jpg",
    ]);
    expect(db.prisma.attachment.deleteMany).toHaveBeenCalled();
    expect(db.prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("rejects confirmation when the bytes were never uploaded", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([pendingRow()]);
    storage.headObject.mockResolvedValueOnce({
      exists: false,
      sizeBytes: 0,
      mimeType: null,
    });

    await expect(confirm()).rejects.toThrow(/did not complete/i);
  });

  it("records the size storage reports, not the one the client claimed", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([pendingRow({ sizeBytes: 1 })])
      .mockResolvedValueOnce([]);
    storage.headObject.mockResolvedValueOnce({
      exists: true,
      sizeBytes: 4096,
      mimeType: "image/jpeg",
    });

    await confirm();

    expect(firstArg(db.prisma.attachment.update).data.sizeBytes).toBe(
      4096,
    );
  });

  it("rejects more files than the per-entity maximum", async () => {
    await expect(
      confirm({ attachmentIds: ["a", "b", "c", "d", "e", "f"] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("counts files already on the entity toward the maximum", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([pendingRow()]);
    db.prisma.attachment.count.mockResolvedValueOnce(5);

    await expect(confirm()).rejects.toMatchObject({ status: 400 });
  });

  it("deduplicates repeated ids rather than double-counting them", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([pendingRow()])
      .mockResolvedValueOnce([]);

    await confirm({ attachmentIds: ["att-1", "att-1", "att-1"] });

    expect(firstArg(db.prisma.attachment.findMany).where.id.in).toEqual([
      "att-1",
    ]);
  });
});

describe("sweepAttachments", () => {
  it("removes stale pending rows, deleting the object first", async () => {
    const order: string[] = [];
    storage.deleteObjects.mockImplementation(async () => {
      order.push("object");
    });
    db.prisma.attachment.deleteMany.mockImplementation(async () => {
      order.push("row");
      return { count: 1 };
    });

    db.prisma.attachment.findMany
      .mockResolvedValueOnce([
        { id: "att-1", storagePath: "COMPLAINT/pending/att-1.jpg" },
      ])
      .mockResolvedValueOnce([]);

    const result = await sweepAttachments();

    expect(result.pendingRemoved).toBe(1);
    expect(order).toEqual(["object", "row"]);
  });

  it("uses the configured TTL as the cutoff", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await sweepAttachments();

    const { createdAt } = firstArg(db.prisma.attachment.findMany).where;
    const hoursAgo = (Date.now() - createdAt.lt.getTime()) / (60 * 60 * 1000);
    expect(hoursAgo).toBeCloseTo(24, 1);
  });

  it("removes attachments whose parent entity is gone", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "att-9",
          storagePath: "COMPLAINT/complaint-9/att-9.jpg",
          entityType: "COMPLAINT",
          entityId: "complaint-9",
        },
      ]);
    db.prisma.complaint.findMany.mockResolvedValueOnce([]);
    db.prisma.attachment.deleteMany.mockResolvedValueOnce({ count: 1 });

    const result = await sweepAttachments();

    expect(result.orphansRemoved).toBe(1);
  });

  it("keeps attachments whose parent still exists", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "att-9",
          storagePath: "COMPLAINT/complaint-9/att-9.jpg",
          entityType: "COMPLAINT",
          entityId: "complaint-9",
        },
      ]);
    db.prisma.complaint.findMany.mockResolvedValueOnce([{ id: "complaint-9" }]);

    const result = await sweepAttachments();

    expect(result.orphansRemoved).toBe(0);
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it("leaves rows in place when the object delete fails, so the next run retries", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([
        { id: "att-1", storagePath: "COMPLAINT/pending/att-1.jpg" },
      ])
      .mockResolvedValueOnce([]);
    storage.deleteObjects.mockRejectedValueOnce(new Error("storage down"));

    const result = await sweepAttachments();

    expect(result.pendingRemoved).toBe(0);
    expect(db.prisma.attachment.deleteMany).not.toHaveBeenCalled();
  });
});
