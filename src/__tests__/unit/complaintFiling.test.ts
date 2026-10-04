/**
 * CC-72 stage 2: filing a complaint, without HTTP.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    complaint: { create: vi.fn(async () => ({ id: "c-new" })) },
    studentProfile: { update: vi.fn(async () => ({})) },
  };
  return { tx, prisma: { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } };
});
const embedding = vi.hoisted(() => ({
  requestEmbedding: vi.fn(async () => undefined),
  triggerDrainInBackground: vi.fn(),
}));
const attachments = vi.hoisted(() => ({ confirmAttachments: vi.fn(async () => []) }));

vi.mock("../../config/database.js", () => ({ prisma: db.prisma }));
vi.mock("../../services/ai/embeddingWorker.js", () => embedding);
vi.mock("../../services/storage/attachments.js", () => attachments);
vi.mock("../../services/sla/policy.js", () => ({ initialSlaDueAt: () => new Date(0) }));
vi.mock("../../services/settings/posting.js", () => ({
  getPostingSettings: async () => ({ allowedCategories: ["FAN", "LIGHT"], doubtSubjects: [] }),
}));
vi.mock("../../utils/notifications.js", () => ({}));
vi.mock("../../services/storage/resolutionEvidence.js", () => ({}));

const { fileComplaint, validateComplaint } = await import("../../services/complaints/filing.js");
const { ComplaintError } = await import("../../services/complaints/lifecycle.js");

const form = {
  title: " Fan broken ",
  description: "The fan in ML03 does not turn",
  category: "FAN",
  priority: "3",
  classroomNumber: "ML03",
  block: "A",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.$transaction.mockImplementation(async (fn: (t: typeof db.tx) => unknown) => fn(db.tx));
});

describe("validateComplaint", () => {
  it("trims text and turns a numeric priority into a number", () => {
    expect(validateComplaint(form, ["FAN"])).toMatchObject({ title: "Fan broken", priority: 3 });
  });

  /** Changed in CC-72: this used to reach the database and come back as a 500. */
  it("rejects a priority that is not a whole number from 1 to 5", () => {
    for (const priority of ["0", "6", "2.5", "high", -1]) {
      expect(() => validateComplaint({ ...form, priority }, ["FAN"])).toThrow(ComplaintError);
    }
  });

  it("requires every field, and blank counts as missing", () => {
    expect(() => validateComplaint({ ...form, title: "   " }, ["FAN"])).toThrow("All fields are required");
    expect(() => validateComplaint({ ...form, priority: undefined }, ["FAN"])).toThrow("All fields are required");
  });

  it("only accepts a category the super admin allows", () => {
    expect(() => validateComplaint({ ...form, category: "PLUMBING" }, ["FAN"])).toThrow(
      "Selected complaint category is not allowed",
    );
  });
});

describe("fileComplaint", () => {
  it("creates, counts and queues for duplicate detection", async () => {
    const complaint = await fileComplaint("stu-1", form);

    expect(complaint).toEqual({ id: "c-new" });
    expect(db.tx.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        priority: 3,
        slaDueAt: new Date(0),
        raisedBy: { connect: { id: "stu-1" } },
      }),
    });
    expect(db.tx.studentProfile.update).toHaveBeenCalled();
    expect(embedding.requestEmbedding).toHaveBeenCalledWith("complaint", "c-new");
  });

  it("binds photos inside the transaction, so a bad photo files nothing", async () => {
    attachments.confirmAttachments.mockRejectedValueOnce(new Error("upload did not finish"));
    await expect(fileComplaint("stu-1", { ...form, attachmentIds: ["att-1"] })).rejects.toThrow();

    expect(attachments.confirmAttachments).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "c-new", tx: db.tx }),
    );
    // The failure propagated out of the transaction callback - rolled back -
    // and nothing was queued for a complaint that does not exist.
    expect(embedding.requestEmbedding).not.toHaveBeenCalled();
  });

  it("does not touch the database for invalid input", async () => {
    await expect(fileComplaint("stu-1", { ...form, priority: "9" })).rejects.toBeInstanceOf(ComplaintError);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });
});
