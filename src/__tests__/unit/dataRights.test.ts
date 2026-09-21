/**
 * CC-64: consent, export and erasure.
 *
 * Two properties carry this. The export must never contain a credential —
 * that is how a portability feature becomes account takeover. And erasure
 * must anonymise rather than cascade-delete, or one person exercising a right
 * destroys everyone else's contributions.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(async () => []),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  });

  return {
    prisma: {
      user: model(),
      consentRecord: model(),
      complaint: model(),
      doubt: model(),
      answer: model(),
      notification: model(),
      doubtBookmark: model(),
      doubtView: model(),
      doubtUpvote: model(),
      answerUpvote: model(),
      refreshToken: model(),
      faceChallenge: model(),
      emailOutbox: model(),
      studentProfile: model(),
      facultyProfile: model(),
      auditLog: model(),
    },
  };
});

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => ({
  DPDP_POLICY_VERSION: "2026-09-21",
}));

import {
  CONSENT_PURPOSES,
  eraseUser,
  exportUserData,
  hasCurrentConsent,
  recordConsent,
} from "../../services/privacy/dataRights.js";


/**
 * First argument of a mock's first (or nth) call.
 *
 * Wrapped because `noUncheckedIndexedAccess` makes every `mock.calls[n][0]` a
 * possibly-undefined access, which would otherwise need assertions at each of
 * the sites below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argOf = (fn: { mock: { calls: any[][] } }, call = 0): any =>
  fn.mock.calls[call]![0];

const account = (over: Record<string, unknown> = {}) => ({
  id: "u-1",
  name: "Ravi Kumar",
  email: "ravi@example.edu",
  userID: "S001",
  university: "Test",
  role: "STUDENT",
  approvalStatus: "APPROVED",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  erasedAt: null,
  emailNotifications: true,
  faceDescriptorEnc: "iv:tag:cipher",
  studentProfile: { phoneNumber: "9999999999", address: "Hostel B" },
  facultyProfile: null,
  adminProfile: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(db.prisma)) {
    model.findMany.mockResolvedValue([]);
    model.deleteMany.mockResolvedValue({ count: 0 });
    model.updateMany.mockResolvedValue({ count: 0 });
    model.update.mockResolvedValue({});
    model.create.mockResolvedValue({});
  }
});

describe("consent", () => {
  it("records what the user was actually shown", async () => {
    await recordConsent({ userId: "u-1", granted: true, ip: "10.0.0.1" });

    const data = argOf(db.prisma.consentRecord.create, 0).data;
    expect(data.granted).toBe(true);
    expect(data.policyVersion).toBe("2026-09-21");
    expect(data.purposes).toEqual([...CONSENT_PURPOSES]);
  });

  it("writes a new row for a withdrawal rather than editing the grant", async () => {
    await recordConsent({ userId: "u-1", granted: false });

    // The history is the point.
    expect(db.prisma.consentRecord.create).toHaveBeenCalledOnce();
    expect(db.prisma.consentRecord.update).not.toHaveBeenCalled();
  });

  it("only counts consent to the CURRENT policy version", async () => {
    db.prisma.consentRecord.findFirst.mockResolvedValueOnce(null);

    await expect(hasCurrentConsent("u-1")).resolves.toBe(false);
    expect(
      argOf(db.prisma.consentRecord.findFirst, 0).where.policyVersion,
    ).toBe("2026-09-21");
  });

  it("treats a withdrawal as not consented", async () => {
    db.prisma.consentRecord.findFirst.mockResolvedValueOnce({ granted: false });

    await expect(hasCurrentConsent("u-1")).resolves.toBe(false);
  });
});

describe("exportUserData", () => {
  beforeEach(() => {
    db.prisma.user.findUnique.mockResolvedValue(account());
  });

  it("returns null for an unknown user", async () => {
    db.prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(exportUserData("nope")).resolves.toBeNull();
  });

  it("NEVER contains a credential or a biometric template", async () => {
    const data = await exportUserData("u-1");
    const json = JSON.stringify(data);

    // The ciphertext itself, which is the thing that must not leave.
    expect(json).not.toContain("iv:tag:cipher");

    // Keys, matched as JSON keys rather than as substrings. A bare
    // `toContain("password")` false-positives on the notIncluded disclosure
    // list, which says the word precisely because the value is absent.
    for (const key of [
      "password",
      "faceDescriptorEnc",
      "faceDescriptor",
      "tokenHash",
      "nonceHash",
      "unsubscribeToken",
    ]) {
      expect(json, `${key} must not be a key in the export`).not.toContain(
        `"${key}":`,
      );
    }
  });

  it("states that a template exists without shipping it", async () => {
    const data = await exportUserData("u-1");

    expect(data!.biometrics.faceTemplateOnFile).toBe(true);
    expect(data!.notIncluded).toContain("face template");
  });

  it("reports no template when there is none", async () => {
    db.prisma.user.findUnique.mockResolvedValueOnce(
      account({ faceDescriptorEnc: null }),
    );

    const data = await exportUserData("u-1");
    expect(data!.biometrics.faceTemplateOnFile).toBe(false);
  });

  it("includes the profile, content and consent history", async () => {
    const data = await exportUserData("u-1");

    expect(data!.user.name).toBe("Ravi Kumar");
    expect(data).toHaveProperty("complaints");
    expect(data).toHaveProperty("doubts");
    expect(data).toHaveProperty("answers");
    expect(data).toHaveProperty("consent");
  });

  it("includes both sides of the audit trail", async () => {
    const data = await exportUserData("u-1");

    expect(data!.auditTrail).toHaveProperty("asActor");
    expect(data!.auditTrail).toHaveProperty("aboutYou");
  });

  it("scopes every query to the one user", async () => {
    await exportUserData("u-1");

    expect(argOf(db.prisma.complaint.findMany, 0).where).toEqual({
      raisedById: "u-1",
    });
    expect(argOf(db.prisma.doubt.findMany, 0).where).toEqual({
      postedById: "u-1",
    });
  });
});

describe("eraseUser", () => {
  beforeEach(() => {
    db.prisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      email: "ravi@example.edu",
      erasedAt: null,
    });
  });

  const erasedData = () => argOf(db.prisma.user.update, 0).data;

  it("throws for an unknown user", async () => {
    db.prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(eraseUser("nope")).rejects.toThrow(/not found/i);
  });

  it("is idempotent — a second call changes nothing", async () => {
    db.prisma.user.findUnique.mockResolvedValueOnce({
      id: "u-1",
      email: "x@y.z",
      erasedAt: new Date(),
    });

    await expect(eraseUser("u-1")).resolves.toEqual({ alreadyErased: true });
    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("replaces the identifiers with a tombstone", async () => {
    const result = await eraseUser("u-1");

    expect(erasedData().name).toBe(result.tombstone);
    expect(erasedData().userID).toBe(result.tombstone);
    expect(erasedData().email).toContain("@erased.invalid");
    expect(erasedData().erasedAt).toBeInstanceOf(Date);
  });

  it("deletes the biometric template outright", async () => {
    await eraseUser("u-1");

    // No retention justification for biometrics, ever.
    expect(erasedData().faceDescriptorEnc).toBeNull();
    expect(erasedData().faceDescriptor).toEqual([]);
  });

  it("makes the account unusable", async () => {
    await eraseUser("u-1");

    expect(erasedData().isActive).toBe(false);
    expect(erasedData().password).not.toBe("");
    expect(erasedData().unsubscribeToken).toBeNull();
  });

  it("clears contact details including guardian data", async () => {
    await eraseUser("u-1");

    const student = argOf(db.prisma.studentProfile.updateMany, 0).data;
    expect(student).toEqual({
      phoneNumber: "",
      address: "",
      guardianName: "",
      guardianPhone: "",
    });
  });

  it("deletes the purely personal rows", async () => {
    await eraseUser("u-1");

    for (const model of [
      "notification",
      "doubtBookmark",
      "doubtView",
      "doubtUpvote",
      "answerUpvote",
      "refreshToken",
      "faceChallenge",
      "consentRecord",
    ] as const) {
      expect(
        db.prisma[model].deleteMany,
        `${model} should be deleted`,
      ).toHaveBeenCalled();
    }
  });

  it("deletes queued and sent mail addressed to them", async () => {
    await eraseUser("u-1");

    expect(argOf(db.prisma.emailOutbox.deleteMany, 0).where).toEqual({
      to: "ravi@example.edu",
    });
  });

  it("KEEPS doubts, answers and complaints", async () => {
    await eraseUser("u-1");

    // A doubt with twelve answers is not only its author's data. DPDP grants
    // erasure of personal data, not of everything a person ever touched.
    expect(db.prisma.doubt.deleteMany).not.toHaveBeenCalled();
    expect(db.prisma.answer.deleteMany).not.toHaveBeenCalled();
    expect(db.prisma.complaint.deleteMany).not.toHaveBeenCalled();
  });

  it("KEEPS the audit log", async () => {
    await eraseUser("u-1");

    // CC-61 made it immutable on purpose; a trail the subject can edit is not
    // a trail.
    expect(db.prisma.auditLog.deleteMany).not.toHaveBeenCalled();
  });

  it("never hard-deletes the user row", async () => {
    await eraseUser("u-1");

    expect(db.prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it("gives each erasure a distinct tombstone", async () => {
    const first = await eraseUser("u-1");
    vi.clearAllMocks();
    db.prisma.user.findUnique.mockResolvedValue({
      id: "u-2",
      email: "b@c.d",
      erasedAt: null,
    });
    db.prisma.user.update.mockResolvedValue({});
    const second = await eraseUser("u-2");

    expect(first.tombstone).not.toBe(second.tombstone);
  });
});
