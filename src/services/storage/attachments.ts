/**
 * Attachment lifecycle (CC-02).
 *
 * Reserve -> upload -> confirm, plus the sweep that cleans up whatever never
 * finished. No HTTP and no Supabase SDK calls live here; storage access goes
 * through supabaseStorage.ts and the routes deal only in these functions.
 *
 * See docs/specs/CC-02-file-storage.md.
 */

import { randomUUID } from "node:crypto";
import { AttachmentEntity, AttachmentStatus } from "@prisma/client";
import type { Attachment, Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_ENTITY,
  ATTACHMENT_PENDING_TTL_HOURS,
  STORAGE_ENABLED,
} from "../../config/env.js";
import {
  STORAGE_BUCKET,
  createSignedUpload,
  deleteObjects,
  headObject,
  type SignedUpload,
} from "./supabaseStorage.js";

/**
 * What may be uploaded.
 *
 * `image/heic` is here because it is the iPhone camera default — leaving it
 * out silently rejects a large share of the student body's photos, which reads
 * to them as "the app is broken", not "that format is unsupported".
 */
export const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * Extension is derived from the allow-listed MIME type, never from the
 * filename the user sent. A filename is attacker-controlled; this mapping is
 * not, and it is only reachable for types that already passed the allow-list.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/** Thrown for conditions a route should turn into a 4xx rather than a 500. */
export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AttachmentError";
  }
}

/**
 * Filenames are displayed, so they are kept — but they are kept *sanitised*.
 * Only the basename survives, control characters are stripped, and the length
 * is bounded. This value never reaches the storage path; see buildStoragePath.
 */
const sanitizeOriginalName = (raw: unknown): string => {
  if (typeof raw !== "string") return "file";

  const basename = raw.split(/[/\\]/).pop() ?? "file";
  // eslint-disable-next-line no-control-regex
  const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  return cleaned.slice(0, 120) || "file";
};

/**
 * Object key. Built entirely from values we control: an enum, a UUID we just
 * generated, and an extension looked up from the allow-list. Nothing the
 * client sent appears here, which is what makes path traversal structurally
 * impossible rather than filtered-out.
 */
const buildStoragePath = (
  entityType: AttachmentEntity,
  attachmentId: string,
  mimeType: string,
): string =>
  `${entityType}/pending/${attachmentId}.${EXTENSION_BY_MIME[mimeType]}`;

export interface ReserveInput {
  entityType: string;
  mimeType: string;
  sizeBytes: number;
  originalName: unknown;
  uploadedById: string;
}

export interface ReservedUpload extends SignedUpload {
  attachmentId: string;
}

/**
 * Validate a requested upload, record it as PENDING, and sign a URL for it.
 *
 * The row is written before the URL is handed out so that an upload can never
 * exist without a record of who asked for it.
 */
export const reserveUpload = async (
  input: ReserveInput,
): Promise<ReservedUpload> => {
  if (!STORAGE_ENABLED) {
    throw new AttachmentError(
      "File uploads are not available on this deployment.",
      503,
    );
  }

  const entityType = parseEntityType(input.entityType);

  const mimeType =
    typeof input.mimeType === "string" ? input.mimeType.trim().toLowerCase() : "";

  if (!ALLOWED_ATTACHMENT_MIME.has(mimeType)) {
    throw new AttachmentError(
      `Unsupported file type. Allowed: ${[...ALLOWED_ATTACHMENT_MIME].join(", ")}`,
      400,
    );
  }

  const sizeBytes = Number(input.sizeBytes);

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new AttachmentError("sizeBytes must be a positive number.", 400);
  }

  if (sizeBytes > ATTACHMENT_MAX_BYTES) {
    throw new AttachmentError(
      `File is too large. Maximum is ${Math.floor(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB.`,
      400,
    );
  }

  const attachmentId = randomUUID();
  const storagePath = buildStoragePath(entityType, attachmentId, mimeType);

  const signed = await createSignedUpload(storagePath);

  await prisma.attachment.create({
    data: {
      id: attachmentId,
      storagePath,
      bucket: STORAGE_BUCKET,
      mimeType,
      sizeBytes,
      originalName: sanitizeOriginalName(input.originalName),
      status: AttachmentStatus.PENDING,
      entityType,
      uploadedById: input.uploadedById,
    },
  });

  return { attachmentId, ...signed };
};

const parseEntityType = (raw: string): AttachmentEntity => {
  if (
    typeof raw === "string" &&
    (Object.values(AttachmentEntity) as string[]).includes(raw)
  ) {
    return raw as AttachmentEntity;
  }

  throw new AttachmentError(
    `entityType must be one of: ${Object.values(AttachmentEntity).join(", ")}`,
    400,
  );
};

export interface ConfirmInput {
  attachmentIds: string[];
  entityType: AttachmentEntity;
  entityId: string;
  userId: string;
  /** Pass the surrounding transaction so the entity and its files commit together. */
  tx?: Prisma.TransactionClient;
}

/**
 * Bind uploaded files to the entity that now owns them.
 *
 * Called from inside the entity's own create handler and inside its
 * transaction, so a complaint that fails validation cannot leave confirmed
 * attachments pointing at a row that was never written.
 *
 * Every check here is an ownership or state check that a client could
 * otherwise bypass by guessing ids, so none of them are optional.
 */
export const confirmAttachments = async (
  input: ConfirmInput,
): Promise<Attachment[]> => {
  const ids = [...new Set(input.attachmentIds)].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );

  if (ids.length === 0) return [];

  if (!STORAGE_ENABLED) {
    // Reaching here means a client sent ids that could not have been issued.
    throw new AttachmentError(
      "File uploads are not available on this deployment.",
      503,
    );
  }

  if (ids.length > ATTACHMENT_MAX_PER_ENTITY) {
    throw new AttachmentError(
      `At most ${ATTACHMENT_MAX_PER_ENTITY} files may be attached.`,
      400,
    );
  }

  const db = input.tx ?? prisma;
  const rows = await db.attachment.findMany({ where: { id: { in: ids } } });

  if (rows.length !== ids.length) {
    throw new AttachmentError("One or more attachments were not found.", 404);
  }

  for (const row of rows) {
    if (row.uploadedById !== input.userId) {
      throw new AttachmentError(
        "You can only attach files you uploaded.",
        403,
      );
    }

    if (row.status !== AttachmentStatus.PENDING) {
      // Re-parenting a confirmed attachment would let one user move another
      // user's evidence onto their own complaint.
      throw new AttachmentError(
        "This file has already been attached to something else.",
        409,
      );
    }

    if (row.entityType !== input.entityType) {
      throw new AttachmentError(
        "This file was uploaded for a different kind of record.",
        400,
      );
    }
  }

  // The real size, from storage. The number captured at signing time was a
  // claim by the client and is not trusted for enforcement.
  const heads = await Promise.all(
    rows.map(async (row) => ({ row, head: await headObject(row.storagePath) })),
  );

  const rejected = heads.filter(
    ({ head }) => !head.exists || head.sizeBytes > ATTACHMENT_MAX_BYTES,
  );

  if (rejected.length > 0) {
    // Delete the bytes before the rows: an object with no row is invisible and
    // bills forever, while a row with no object is merely a broken thumbnail.
    await deleteObjects(rejected.map(({ row }) => row.storagePath)).catch(
      (error) =>
        console.error("[CC-02] cleanup of rejected upload failed:", error),
    );
    await db.attachment.deleteMany({
      where: { id: { in: rejected.map(({ row }) => row.id) } },
    });

    const missing = rejected.some(({ head }) => !head.exists);
    throw new AttachmentError(
      missing
        ? "Upload did not complete. Please try again."
        : "File is larger than the allowed maximum.",
      400,
    );
  }

  const alreadyAttached = await db.attachment.count({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      status: AttachmentStatus.ATTACHED,
    },
  });

  if (alreadyAttached + ids.length > ATTACHMENT_MAX_PER_ENTITY) {
    throw new AttachmentError(
      `At most ${ATTACHMENT_MAX_PER_ENTITY} files may be attached.`,
      400,
    );
  }

  const confirmedAt = new Date();

  await Promise.all(
    heads.map(({ row, head }) =>
      db.attachment.update({
        where: { id: row.id },
        data: {
          status: AttachmentStatus.ATTACHED,
          entityId: input.entityId,
          confirmedAt,
          // Trust storage over the client for the recorded size.
          sizeBytes: head.sizeBytes || row.sizeBytes,
        },
      }),
    ),
  );

  return db.attachment.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" },
  });
};

/** Confirmed attachments for one entity. PENDING rows are never returned. */
export const listForEntity = async (
  entityType: AttachmentEntity,
  entityId: string,
): Promise<Attachment[]> => {
  // Not merely an optimisation: with storage switched off the Attachment table
  // may not have been migrated yet, and querying it would turn every complaint
  // read into a 500.
  if (!STORAGE_ENABLED) return [];

  return prisma.attachment.findMany({
    where: { entityType, entityId, status: AttachmentStatus.ATTACHED },
    orderBy: { createdAt: "asc" },
  });
};

/** Confirmed attachments for many entities at once, keyed by entity id. */
export const listForEntities = async (
  entityType: AttachmentEntity,
  entityIds: string[],
): Promise<Map<string, Attachment[]>> => {
  const grouped = new Map<string, Attachment[]>();

  if (!STORAGE_ENABLED || entityIds.length === 0) return grouped;

  const rows = await prisma.attachment.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      status: AttachmentStatus.ATTACHED,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const row of rows) {
    if (!row.entityId) continue;
    const list = grouped.get(row.entityId) ?? [];
    list.push(row);
    grouped.set(row.entityId, list);
  }

  return grouped;
};

export interface SweepResult {
  pendingRemoved: number;
  orphansRemoved: number;
}

/**
 * Remove what no longer has an owner.
 *
 * Two leaks are possible: an upload that was signed and never confirmed, and a
 * confirmed attachment whose parent was later deleted — the latter being the
 * price of `entityId` not being a foreign key.
 *
 * Objects are deleted before rows, always. If the object delete fails the row
 * survives and the next run retries it; if it were the other way round the
 * object would be unreachable and billable forever.
 */
export const sweepAttachments = async (): Promise<SweepResult> => {
  if (!STORAGE_ENABLED) return { pendingRemoved: 0, orphansRemoved: 0 };

  const cutoff = new Date(
    Date.now() - ATTACHMENT_PENDING_TTL_HOURS * 60 * 60 * 1000,
  );

  const stalePending = await prisma.attachment.findMany({
    where: { status: AttachmentStatus.PENDING, createdAt: { lt: cutoff } },
    select: { id: true, storagePath: true },
  });

  const pendingRemoved = await removeAttachments(stalePending);
  const orphansRemoved = await removeAttachments(await findOrphans());

  return { pendingRemoved, orphansRemoved };
};

/**
 * Confirmed attachments whose parent row is gone.
 *
 * Checked per entity type because there is no join to lean on — the same
 * trade-off recorded on the schema.
 */
const findOrphans = async (): Promise<
  Array<{ id: string; storagePath: string }>
> => {
  const attached = await prisma.attachment.findMany({
    where: { status: AttachmentStatus.ATTACHED, entityId: { not: null } },
    select: { id: true, storagePath: true, entityType: true, entityId: true },
  });

  if (attached.length === 0) return [];

  const idsBy = (type: AttachmentEntity) =>
    attached
      .filter((row) => row.entityType === type)
      .map((row) => row.entityId as string);

  const complaintIds = [
    ...idsBy(AttachmentEntity.COMPLAINT),
    ...idsBy(AttachmentEntity.COMPLAINT_RESOLUTION),
  ];
  const doubtIds = idsBy(AttachmentEntity.DOUBT);
  const answerIds = idsBy(AttachmentEntity.ANSWER);

  const [complaints, doubts, answers] = await Promise.all([
    complaintIds.length
      ? prisma.complaint.findMany({
          where: { id: { in: complaintIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    doubtIds.length
      ? prisma.doubt.findMany({
          where: { id: { in: doubtIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
    answerIds.length
      ? prisma.answer.findMany({
          where: { id: { in: answerIds } },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const live = new Set([
    ...complaints.map((row) => row.id),
    ...doubts.map((row) => row.id),
    ...answers.map((row) => row.id),
  ]);

  return attached
    .filter((row) => !live.has(row.entityId as string))
    .map((row) => ({ id: row.id, storagePath: row.storagePath }));
};

const removeAttachments = async (
  rows: Array<{ id: string; storagePath: string }>,
): Promise<number> => {
  if (rows.length === 0) return 0;

  try {
    await deleteObjects(rows.map((row) => row.storagePath));
  } catch (error) {
    // Leave the rows in place so the next run retries them.
    console.error("[CC-02] sweep could not delete objects:", error);
    return 0;
  }

  const { count } = await prisma.attachment.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } },
  });

  return count;
};
