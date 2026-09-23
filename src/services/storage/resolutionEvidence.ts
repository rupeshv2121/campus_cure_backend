/**
 * Resolution evidence — CC-30.
 *
 * The "after" half of before/after proof. CC-02 shipped the `COMPLAINT` write
 * path (a student photographs the broken chair) and added
 * `COMPLAINT_RESOLUTION` to the enum, to the read authorization in
 * `uploads.ts` and to the orphan sweep — but nothing ever *created* one. This
 * module is the missing write path.
 *
 * It lives here rather than inline in the two controllers because faculty and
 * admins resolve complaints through separate handlers
 * (`facultyController.updateComplaintStatus` and
 * `adminController.updateComplaintStatus`) that already differ in their status
 * rules. Duplicating the evidence logic across both is how the two quietly
 * diverge — one gains a check the other never gets.
 */
import { AttachmentEntity, ComplaintStatus } from "@prisma/client";
import type { Attachment, Prisma } from "@prisma/client";
import {
  AttachmentError,
  confirmAttachments,
  listForEntities,
} from "./attachments.js";

/**
 * Statuses at which resolution evidence is meaningful.
 *
 * `PENDING_CONFIRMATION` is the important one: that is the moment staff claim
 * the work is done and the student is asked to agree. A photo attached at
 * `IN_PROGRESS` would be evidence of nothing in particular, and one attached
 * after `RESOLVED` arrives too late to inform the decision it exists to
 * support.
 */
const EVIDENCE_STATUSES = new Set<string>([
  ComplaintStatus.PENDING_CONFIRMATION,
  ComplaintStatus.RESOLVED,
]);

export const acceptsResolutionEvidence = (status: string): boolean =>
  EVIDENCE_STATUSES.has(status);

export interface AttachEvidenceInput {
  /** Ids from `POST /api/uploads/sign` with entityType COMPLAINT_RESOLUTION. */
  attachmentIds: unknown;
  complaintId: string;
  /** The staff member resolving it. Only their own uploads may be bound. */
  userId: string;
  /** The status being moved to. */
  status: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Bind resolution photos to a complaint.
 *
 * Returns [] when there is nothing to attach, which is the common case —
 * evidence is encouraged, never required. Making it mandatory would mean a
 * genuinely fixed fault could not be closed because the corridor was too dark
 * to photograph, and staff would learn to upload a blank frame to get past the
 * validation. An optional photo that is usually present beats a mandatory one
 * that is usually meaningless.
 */
export const attachResolutionEvidence = async (
  input: AttachEvidenceInput,
): Promise<Attachment[]> => {
  const ids = Array.isArray(input.attachmentIds) ? input.attachmentIds : [];
  if (ids.length === 0) return [];

  if (!acceptsResolutionEvidence(input.status)) {
    throw new AttachmentError(
      "Resolution photos can only be added when marking a complaint resolved " +
        "or awaiting student confirmation.",
      400,
    );
  }

  return confirmAttachments({
    attachmentIds: ids as string[],
    entityType: AttachmentEntity.COMPLAINT_RESOLUTION,
    entityId: input.complaintId,
    userId: input.userId,
    ...(input.tx ? { tx: input.tx } : {}),
  });
};

/** What a list endpoint returns per file. Never a URL — see below. */
export interface AttachmentSummary {
  id: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

const summarise = (rows: Attachment[]): AttachmentSummary[] =>
  rows.map(({ id, mimeType, originalName, sizeBytes }) => ({
    id,
    mimeType,
    originalName,
    sizeBytes,
  }));

export interface WithEvidence {
  attachments: AttachmentSummary[];
  resolutionAttachments: AttachmentSummary[];
}

/**
 * Attach both halves of the before/after pair to a list of complaints.
 *
 * Two batched queries for the whole page, never one per complaint — the N+1
 * here would be doubled, since every complaint has two kinds of attachment.
 *
 * No signed URLs are included. They expire in minutes, so a URL baked into a
 * list response would be dead by the time anyone clicked it; the client mints
 * one per view through `GET /api/attachments/:id`.
 *
 * Used by the student, faculty and admin list endpoints alike. Before CC-30
 * the staff endpoints returned no attachments at all, which meant the faculty
 * member assigned to fix a broken chair could not see the photograph of it -
 * removing exactly the round trip the feature exists to remove.
 */
export const withEvidence = async <T extends { id: string }>(
  complaints: T[],
): Promise<Array<T & WithEvidence>> => {
  const ids = complaints.map((complaint) => complaint.id);

  const [before, after] = await Promise.all([
    listForEntities(AttachmentEntity.COMPLAINT, ids),
    listForEntities(AttachmentEntity.COMPLAINT_RESOLUTION, ids),
  ]);

  return complaints.map((complaint) => ({
    ...complaint,
    attachments: summarise(before.get(complaint.id) ?? []),
    resolutionAttachments: summarise(after.get(complaint.id) ?? []),
  }));
};
