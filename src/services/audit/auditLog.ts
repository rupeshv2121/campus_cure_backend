/**
 * The audit trail (CC-61).
 *
 * Append-only by construction: this module writes and reads, and there is
 * deliberately no update or delete anywhere in it. A database trigger backs
 * that up — see the migration.
 *
 * See docs/specs/CC-61-audit-log.md.
 */

import { AuditActor, Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { AuthRequest } from "../../types/index.js";

/**
 * Dotted action names.
 *
 * A const object rather than an enum in the schema: a schema enum would mean a
 * migration every time a new action is audited, and that tax gets paid by not
 * auditing the new thing.
 */
export const AuditAction = {
  USER_APPROVE: "user.approve",
  USER_REJECT: "user.reject",
  USER_APPROVAL_STATUS_CHANGE: "user.approval_status_change",
  USER_ACTIVE_TOGGLE: "user.active_toggle",
  ADMIN_PERMISSIONS_CHANGE: "admin.permissions_change",
  SETTINGS_UPDATE: "settings.update",
  COMPLAINT_ASSIGN: "complaint.assign",
  COMPLAINT_STATUS_CHANGE: "complaint.status_change",
  COMPLAINT_REASSIGN: "complaint.reassign",
  COMPLAINT_ESCALATE: "complaint.escalate",
  FACE_CLEAR: "face.clear",
  DATA_EXPORT: "data.export",
  DATA_ERASE: "data.erase",
} as const;

export type AuditActionValue =
  (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Metadata keys whose values are never written.
 *
 * Audit metadata is attacker-interesting by construction — it describes
 * exactly the actions worth attacking. This matters most for CC-60: an entry
 * saying "face template cleared" must not contain the template.
 */
const SENSITIVE_KEY = /password|token|secret|key|descriptor|nonce|hash/i;

const REDACTED = "[redacted]";

/** Deep-scrub a metadata payload. Arrays and nested objects included. */
export const redact = (value: unknown, depth = 0): unknown => {
  // Bounded so a cyclic or pathological payload cannot hang the request.
  if (depth > 6) return REDACTED;

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, depth + 1);
    }

    return out;
  }

  return value;
};

export interface AuditActorInfo {
  actorType: AuditActor;
  actorId?: string | undefined;
  actorRole?: string | undefined;
  actorLabel?: string | undefined;
}

/**
 * Snapshot who is acting, from the request.
 *
 * The snapshot is the point: an entry must stay meaningful after the account
 * is deleted or its role changes. Resolving the actor later would answer
 * today's question about a past event.
 */
export const actorFromRequest = (req: AuthRequest): AuditActorInfo => ({
  actorType: AuditActor.USER,
  actorId: req.user?.id,
  actorRole: req.user?.role,
  actorLabel: req.user?.userID,
});

/**
 * The system acting on its own — CC-31's nightly escalation.
 *
 * Without this, a scheduled action is either unattributable or falsely
 * attributed to whoever happened to trigger the cron.
 */
export const systemActor = (): AuditActorInfo => ({
  actorType: AuditActor.SYSTEM,
  actorLabel: "system",
});

export interface RecordAuditInput extends AuditActorInfo {
  action: AuditActionValue;
  targetType: string;
  targetId?: string | undefined;
  summary: string;
  metadata?: unknown;
  ip?: string | undefined;
  userAgent?: string | undefined;
  /**
   * Pass the surrounding transaction to make the audit row commit atomically
   * with the action it describes. Where that is not available the write is
   * best-effort — see the spec's note on the tension there.
   */
  tx?: Prisma.TransactionClient | undefined;
}

/**
 * Write one audit row.
 *
 * NEVER THROWS. A logging failure must not leave an admin unable to approve a
 * student. The strict-compliance reading is the opposite — no log, no action —
 * and the spec argues the compromise: atomic where a transaction already
 * exists, best-effort everywhere else.
 */
export const recordAudit = async (input: RecordAuditInput): Promise<void> => {
  try {
    const db = input.tx ?? prisma;

    await db.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        summary: input.summary,
        // Prisma.DbNull rather than undefined: with exactOptionalPropertyTypes
        // an omitted key is not assignable to a nullable Json column.
        metadata:
          input.metadata === undefined
            ? Prisma.DbNull
            : (redact(input.metadata) as Prisma.InputJsonValue),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    // Loud, because a silently missing audit trail is worse than a noisy one.
    console.error(
      `[CC-61] AUDIT WRITE FAILED for ${input.action} on ${input.targetType}` +
        `${input.targetId ? `/${input.targetId}` : ""}:`,
      (error as Error).message,
    );
  }
};

/** Convenience: record an action performed by the caller of a request. */
export const auditFromRequest = async (
  req: AuthRequest,
  input: Omit<RecordAuditInput, keyof AuditActorInfo>,
): Promise<void> =>
  recordAudit({
    ...actorFromRequest(req),
    ip: req.ip,
    userAgent: req.headers?.["user-agent"] as string | undefined,
    ...input,
  });

export interface AuditQuery {
  action?: string | undefined;
  actorId?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/** Hard ceiling, so a filter-free request cannot pull the whole table. */
export const MAX_PAGE_SIZE = 100;

export const queryAuditLog = async (query: AuditQuery) => {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(query.pageSize ?? 50)),
  );

  const where: Prisma.AuditLogWhereInput = {};

  if (query.action) where.action = query.action;
  if (query.actorId) where.actorId = query.actorId;
  if (query.targetType) where.targetType = query.targetType;
  if (query.targetId) where.targetId = query.targetId;

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { entries, total, page, pageSize };
};
