/**
 * CC-30: resolution evidence.
 *
 * CC-02 shipped the "before" half and added `COMPLAINT_RESOLUTION` to the
 * enum, to the read authorization and to the orphan sweep — but nothing ever
 * created one. These tests cover the write path that was missing, and the
 * batched read that stops it being an N+1 on every complaint list.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const attachments = vi.hoisted(() => ({
  AttachmentError: class AttachmentError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = "AttachmentError";
    }
  },
  confirmAttachments: vi.fn(),
  listForEntities: vi.fn(),
}));

vi.mock("../../services/storage/attachments.js", () => attachments);

import {
  acceptsResolutionEvidence,
  attachResolutionEvidence,
  withEvidence,
} from "../../services/storage/resolutionEvidence.js";

const row = (id: string, name: string) => ({
  id,
  mimeType: "image/jpeg",
  originalName: name,
  sizeBytes: 1000,
  // Fields the summary must NOT leak into an API response.
  storagePath: "COMPLAINT/x/secret-path.jpg",
  bucket: "campuscure-attachments",
  uploadedById: "staff-1",
  status: "ATTACHED",
});

beforeEach(() => {
  vi.clearAllMocks();
  attachments.confirmAttachments.mockResolvedValue([]);
  attachments.listForEntities.mockResolvedValue(new Map());
});

describe("acceptsResolutionEvidence", () => {
  it.each(["PENDING_CONFIRMATION", "RESOLVED"])("accepts %s", (status) => {
    expect(acceptsResolutionEvidence(status)).toBe(true);
  });

  /**
   * A photo at IN_PROGRESS is evidence of nothing in particular. The moment
   * that matters is when staff CLAIM the work is done and the student is asked
   * to agree.
   */
  it.each(["RAISED", "ASSIGNED", "IN_PROGRESS", "ESCALATED_TO_SUPERADMIN"])(
    "rejects %s",
    (status) => {
      expect(acceptsResolutionEvidence(status)).toBe(false);
    },
  );
});

describe("attachResolutionEvidence", () => {
  it("binds files as COMPLAINT_RESOLUTION, not COMPLAINT", async () => {
    await attachResolutionEvidence({
      attachmentIds: ["a1", "a2"],
      complaintId: "c1",
      userId: "staff-1",
      status: "PENDING_CONFIRMATION",
    });

    expect(attachments.confirmAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentIds: ["a1", "a2"],
        entityType: "COMPLAINT_RESOLUTION",
        entityId: "c1",
        userId: "staff-1",
      }),
    );
  });

  /**
   * Evidence is encouraged, never required. Requiring it would mean a
   * genuinely fixed fault could not be closed because the corridor was too
   * dark to photograph — and staff would learn to upload a blank frame.
   */
  it.each([[[]], [undefined], [null], ["not-an-array"], [{}]])(
    "does nothing for %s",
    async (ids) => {
      const result = await attachResolutionEvidence({
        attachmentIds: ids,
        complaintId: "c1",
        userId: "staff-1",
        status: "PENDING_CONFIRMATION",
      });

      expect(result).toEqual([]);
      expect(attachments.confirmAttachments).not.toHaveBeenCalled();
    },
  );

  it("rejects evidence on a status where it means nothing", async () => {
    await expect(
      attachResolutionEvidence({
        attachmentIds: ["a1"],
        complaintId: "c1",
        userId: "staff-1",
        status: "IN_PROGRESS",
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(attachments.confirmAttachments).not.toHaveBeenCalled();
  });

  it("passes a transaction through when given one", async () => {
    const tx = { marker: true };
    await attachResolutionEvidence({
      attachmentIds: ["a1"],
      complaintId: "c1",
      userId: "staff-1",
      status: "RESOLVED",
      tx: tx as never,
    });

    expect(attachments.confirmAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
    );
  });

  /**
   * Ownership and the already-attached check live in confirmAttachments, so
   * this layer must not swallow what it throws — a 403 becoming a 500 would
   * tell staff "server error" when the real answer is "that is not your file".
   */
  it("propagates an AttachmentError from the layer below", async () => {
    attachments.confirmAttachments.mockRejectedValue(
      new attachments.AttachmentError("not yours", 403),
    );

    await expect(
      attachResolutionEvidence({
        attachmentIds: ["a1"],
        complaintId: "c1",
        userId: "staff-1",
        status: "RESOLVED",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("withEvidence", () => {
  it("returns both halves, keyed to the right complaint", async () => {
    attachments.listForEntities.mockImplementation(
      async (entityType: string) =>
        entityType === "COMPLAINT"
          ? new Map([["c1", [row("before-1", "chair.jpg")]]])
          : new Map([["c1", [row("after-1", "fixed.jpg")]]]),
    );

    const [complaint] = await withEvidence([{ id: "c1", title: "Broken" }]);

    expect(complaint!.attachments).toHaveLength(1);
    expect(complaint!.attachments[0]!.originalName).toBe("chair.jpg");
    expect(complaint!.resolutionAttachments[0]!.originalName).toBe("fixed.jpg");
    expect(complaint!.title).toBe("Broken");
  });

  /**
   * The storage path is a server-side object key. Leaking it into a list
   * response hands every caller the shape of the bucket, which is exactly what
   * the private-bucket design is trying not to publish.
   */
  it("exposes only the four display fields, never the storage path", async () => {
    attachments.listForEntities.mockResolvedValue(
      new Map([["c1", [row("a1", "x.jpg")]]]),
    );

    const [complaint] = await withEvidence([{ id: "c1" }]);

    expect(Object.keys(complaint!.attachments[0]!).sort()).toEqual([
      "id",
      "mimeType",
      "originalName",
      "sizeBytes",
    ]);
  });

  /**
   * Two queries for the whole page, not two per complaint. The N+1 here would
   * be doubled, because every complaint has two kinds of attachment.
   */
  it("makes exactly two queries regardless of page size", async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}` }));
    await withEvidence(many);

    expect(attachments.listForEntities).toHaveBeenCalledTimes(2);
    expect(attachments.listForEntities).toHaveBeenCalledWith(
      "COMPLAINT",
      expect.arrayContaining(["c0", "c49"]),
    );
  });

  it("gives empty arrays, never undefined, when there is nothing", async () => {
    const [complaint] = await withEvidence([{ id: "c1" }]);
    expect(complaint!.attachments).toEqual([]);
    expect(complaint!.resolutionAttachments).toEqual([]);
  });

  it("handles an empty page without querying for nothing", async () => {
    expect(await withEvidence([])).toEqual([]);
  });
});
