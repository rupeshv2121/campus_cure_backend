/**
 * CC-24: attachments on doubts and answers.
 *
 * The layer is CC-02's; this covers the binding. The property that matters is
 * that everything stays inert and clean while CC-02 is dormant, because that
 * is the state it ships in.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  STORAGE_ENABLED: false,
  ATTACHMENT_MAX_BYTES: 5 * 1024 * 1024,
  ATTACHMENT_MAX_PER_ENTITY: 5,
  ATTACHMENT_PENDING_TTL_HOURS: 24,
}));

const db = vi.hoisted(() => ({
  prisma: {
    // Args and return types are declared rather than inferred: `vi.fn(async
    // () => [])` infers never[], which makes every mockResolvedValueOnce with
    // a real row a type error, and the call tuple empty.
    attachment: {
      create: vi.fn(),
      findMany: vi.fn(
        async (_args: { where: Record<string, unknown> }) =>
          [] as Array<Record<string, unknown>>,
      ),
      update: vi.fn(),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
  },
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);
vi.mock("./../../services/storage/supabaseStorage.js", () => ({
  STORAGE_BUCKET: "test",
  createSignedUpload: vi.fn(),
  createSignedDownload: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

import {
  AttachmentError,
  bindPostAttachments,
  confirmAttachments,
  listForEntities,
} from "../../services/storage/attachments.js";

beforeEach(() => {
  vi.clearAllMocks();
  env.STORAGE_ENABLED = false;
});

describe("with CC-02 dormant — the state this ships in", () => {
  it("returns no attachments for doubts without querying", async () => {
    await expect(
      listForEntities("DOUBT", ["d-1", "d-2"]),
    ).resolves.toEqual(new Map());

    // The Attachment table may not be migrated everywhere.
    expect(db.prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it("returns no attachments for answers without querying", async () => {
    await expect(listForEntities("ANSWER", ["a-1"])).resolves.toEqual(new Map());
    expect(db.prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it("refuses to bind with a 503, not a 500", async () => {
    // The handler turns this into a clean error for the student rather than
    // an opaque server fault.
    const error = await confirmAttachments({
      attachmentIds: ["att-1"],
      entityType: "DOUBT",
      entityId: "d-1",
      userId: "u-1",
    } as Parameters<typeof confirmAttachments>[0]).catch((e) => e);

    expect(error).toBeInstanceOf(AttachmentError);
    expect(error.status).toBe(503);
  });

  it("is a no-op for an empty id list, even when off", async () => {
    await expect(
      confirmAttachments({
        attachmentIds: [],
        entityType: "DOUBT",
        entityId: "d-1",
        userId: "u-1",
      } as Parameters<typeof confirmAttachments>[0]),
    ).resolves.toEqual([]);
  });
});

describe("with storage live", () => {
  beforeEach(() => {
    env.STORAGE_ENABLED = true;
  });

  it("queries doubt attachments scoped to the right entity type", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([]);

    await listForEntities("DOUBT", ["d-1"]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = db.prisma.attachment.findMany.mock.calls[0]![0].where as any;
    expect(where.entityType).toBe("DOUBT");
    expect(where.entityId.in).toEqual(["d-1"]);
    // A pending reservation is not a file anyone may see.
    expect(where.status).toBe("ATTACHED");
  });

  it("groups answer attachments by answer id", async () => {
    db.prisma.attachment.findMany.mockResolvedValueOnce([
      { id: "f-1", entityId: "a-1" },
      { id: "f-2", entityId: "a-1" },
      { id: "f-3", entityId: "a-2" },
    ]);

    const grouped = await listForEntities("ANSWER", ["a-1", "a-2"]);

    expect(grouped.get("a-1")).toHaveLength(2);
    expect(grouped.get("a-2")).toHaveLength(1);
  });

  it("does not query for an empty entity list", async () => {
    await expect(listForEntities("DOUBT", [])).resolves.toEqual(new Map());
    expect(db.prisma.attachment.findMany).not.toHaveBeenCalled();
  });
});

/**
 * CC-23 inline images ride on the same binding as the attachment tray. These
 * tests cover only what bindPostAttachments adds on top of confirmAttachments:
 * merging the two sources, and letting an edit keep images already bound.
 */
describe("bindPostAttachments", () => {
  beforeEach(() => {
    env.STORAGE_ENABLED = true;
  });

  it("does nothing, and queries nothing, for a post with no files", async () => {
    await expect(
      bindPostAttachments({
        entityType: "DOUBT",
        entityId: "d-1",
        userId: "u-1",
        attachmentIds: undefined,
        inlineImageIds: [],
      } as Parameters<typeof bindPostAttachments>[0]),
    ).resolves.toEqual([]);
    expect(db.prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it("skips images already bound to this post, so an edit can keep them", async () => {
    // First query: which ids are already bound here. Second: confirm's lookup.
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([{ id: "img-old" }])
      .mockResolvedValueOnce([]);

    const error = await bindPostAttachments({
      entityType: "DOUBT",
      entityId: "d-1",
      userId: "u-1",
      inlineImageIds: ["img-old", "img-new"],
    } as Parameters<typeof bindPostAttachments>[0]).catch((e) => e);

    // Only the new id reaches confirm, which then 404s on our empty mock.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confirmWhere = db.prisma.attachment.findMany.mock.calls[1]![0].where as any;
    expect(confirmWhere.id.in).toEqual(["img-new"]);
    expect(error).toBeInstanceOf(AttachmentError);
  });

  it("scopes 'already bound' to this post, type and ATTACHED state", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([{ id: "img-1" }]);

    await bindPostAttachments({
      entityType: "ANSWER",
      entityId: "a-9",
      userId: "u-1",
      attachmentIds: ["img-1"],
    } as Parameters<typeof bindPostAttachments>[0]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = db.prisma.attachment.findMany.mock.calls[0]![0].where as any;
    expect(where).toMatchObject({
      entityType: "ANSWER",
      entityId: "a-9",
      status: "ATTACHED",
    });
  });

  /**
   * Naming an image that is attached to someone else's post must fail the
   * request, not borrow the file. confirmAttachments' state check does that;
   * this asserts the inline path actually reaches it.
   */
  it("refuses an inline image already bound to a different post", async () => {
    db.prisma.attachment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "img-x",
          uploadedById: "u-1",
          status: "ATTACHED",
          entityType: "DOUBT",
        },
      ]);

    const error = await bindPostAttachments({
      entityType: "DOUBT",
      entityId: "d-mine",
      userId: "u-1",
      inlineImageIds: ["img-x"],
    } as Parameters<typeof bindPostAttachments>[0]).catch((e) => e);

    expect(error).toBeInstanceOf(AttachmentError);
    expect((error as AttachmentError).status).toBe(409);
  });
});
