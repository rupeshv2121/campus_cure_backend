/**
 * CC-61: the audit trail.
 *
 * Two properties carry it: a secret must never reach the log, and a logging
 * failure must never break the action being logged. The rest is the actor
 * snapshot, which is what keeps an entry meaningful after the account is gone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("../../config/database.js", () => db);

import {
  AuditAction,
  MAX_PAGE_SIZE,
  actorFromRequest,
  auditFromRequest,
  queryAuditLog,
  recordAudit,
  redact,
  systemActor,
} from "../../services/audit/auditLog.js";

const created = (call = 0) => db.prisma.auditLog.create.mock.calls[call]![0].data;

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.auditLog.create.mockResolvedValue({ id: "a-1" });
  db.prisma.auditLog.findMany.mockResolvedValue([]);
  db.prisma.auditLog.count.mockResolvedValue(0);
});

describe("redact", () => {
  it("removes obviously sensitive keys", () => {
    expect(
      redact({ password: "hunter2", token: "t", secret: "s", apiKey: "k" }),
    ).toEqual({
      password: "[redacted]",
      token: "[redacted]",
      secret: "[redacted]",
      apiKey: "[redacted]",
    });
  });

  it("removes a face descriptor", () => {
    // The whole point for CC-60: "face template cleared" must not carry the
    // template.
    const out = redact({ faceDescriptor: [0.1, 0.2], userId: "u-1" }) as Record<
      string,
      unknown
    >;

    expect(out.faceDescriptor).toBe("[redacted]");
    expect(out.userId).toBe("u-1");
  });

  it("is case-insensitive and matches substrings", () => {
    const out = redact({
      Password: "x",
      NONCE: "y",
      tokenHash: "z",
    }) as Record<string, unknown>;

    expect(Object.values(out)).toEqual([
      "[redacted]",
      "[redacted]",
      "[redacted]",
    ]);
  });

  it("descends into nested objects and arrays", () => {
    const out = redact({
      outer: { inner: { secret: "s", safe: 1 } },
      list: [{ token: "t" }, { ok: true }],
    }) as Record<string, Record<string, unknown>>;

    expect((out.outer!.inner as Record<string, unknown>).secret).toBe(
      "[redacted]",
    );
    expect((out.outer!.inner as Record<string, unknown>).safe).toBe(1);
    expect((out.list as unknown as Record<string, unknown>[])[0]!.token).toBe(
      "[redacted]",
    );
  });

  it("leaves ordinary values alone", () => {
    expect(redact({ role: "ADMIN", count: 3, ok: true })).toEqual({
      role: "ADMIN",
      count: 3,
      ok: true,
    });
  });

  it("bounds depth so a pathological payload cannot hang a request", () => {
    let deep: Record<string, unknown> = { value: 1 };
    for (let i = 0; i < 20; i += 1) deep = { nest: deep };

    expect(() => redact(deep)).not.toThrow();
  });
});

describe("actors", () => {
  const req = {
    user: { id: "u-1", role: "ADMIN", userID: "A001" },
    ip: "10.0.0.1",
    headers: { "user-agent": "vitest" },
  } as never;

  it("snapshots who the user was, not a reference to them", () => {
    expect(actorFromRequest(req)).toEqual({
      actorType: "USER",
      actorId: "u-1",
      actorRole: "ADMIN",
      actorLabel: "A001",
    });
  });

  it("marks system actions as SYSTEM with no actor id", () => {
    const actor = systemActor();

    expect(actor.actorType).toBe("SYSTEM");
    expect(actor.actorId).toBeUndefined();
  });

  it("carries ip and user agent from the request", async () => {
    await auditFromRequest(req, {
      action: AuditAction.USER_APPROVE,
      targetType: "User",
      targetId: "u-2",
      summary: "Approved",
    });

    expect(created().ip).toBe("10.0.0.1");
    expect(created().userAgent).toBe("vitest");
  });
});

describe("recordAudit", () => {
  const base = {
    actorType: "USER" as const,
    actorId: "u-1",
    action: AuditAction.USER_APPROVE,
    targetType: "User",
    targetId: "u-2",
    summary: "Approved a student",
  };

  it("writes one row", async () => {
    await recordAudit(base);

    expect(db.prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(created().action).toBe("user.approve");
    expect(created().targetId).toBe("u-2");
  });

  it("redacts metadata on the way in", async () => {
    await recordAudit({ ...base, metadata: { password: "x", role: "ADMIN" } });

    expect(created().metadata).toEqual({
      password: "[redacted]",
      role: "ADMIN",
    });
  });

  it("NEVER throws when the write fails", async () => {
    db.prisma.auditLog.create.mockRejectedValueOnce(new Error("db down"));

    // A logging failure must not leave an admin unable to approve a student.
    await expect(recordAudit(base)).resolves.toBeUndefined();
  });

  it("uses the surrounding transaction when given one", async () => {
    const tx = { auditLog: { create: vi.fn().mockResolvedValue({}) } };

    await recordAudit({ ...base, tx: tx as never });

    // Atomic with the action it describes.
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(db.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("has no update or delete surface at all", async () => {
    const audit = await import("../../services/audit/auditLog.js");

    // Append-only by construction, not only by convention.
    expect(Object.keys(audit).join(",")).not.toMatch(/update|delete/i);
  });
});

describe("queryAuditLog", () => {
  it("returns newest first", async () => {
    await queryAuditLog({});

    expect(db.prisma.auditLog.findMany.mock.calls[0]![0].orderBy).toEqual({
      createdAt: "desc",
    });
  });

  it("caps the page size so a filter-free request cannot pull the table", async () => {
    await queryAuditLog({ pageSize: 5000 });

    expect(db.prisma.auditLog.findMany.mock.calls[0]![0].take).toBe(
      MAX_PAGE_SIZE,
    );
  });

  it("clamps nonsense paging", async () => {
    await queryAuditLog({ page: -3, pageSize: 0 });

    const call = db.prisma.auditLog.findMany.mock.calls[0]![0];
    expect(call.skip).toBe(0);
    expect(call.take).toBeGreaterThan(0);
  });

  it("filters by action and target", async () => {
    await queryAuditLog({
      action: "complaint.assign",
      targetType: "Complaint",
      targetId: "c-1",
    });

    expect(db.prisma.auditLog.findMany.mock.calls[0]![0].where).toEqual({
      action: "complaint.assign",
      targetType: "Complaint",
      targetId: "c-1",
    });
  });

  it("filters by date range", async () => {
    const from = new Date("2026-09-01");
    const to = new Date("2026-09-21");

    await queryAuditLog({ from, to });

    expect(db.prisma.auditLog.findMany.mock.calls[0]![0].where.createdAt).toEqual(
      { gte: from, lte: to },
    );
  });

  it("reports the total alongside the page", async () => {
    db.prisma.auditLog.count.mockResolvedValueOnce(137);

    const result = await queryAuditLog({ page: 2, pageSize: 10 });

    expect(result.total).toBe(137);
    expect(result.page).toBe(2);
  });
});
