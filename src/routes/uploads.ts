/**
 * Upload signing and attachment download (CC-02).
 *
 * Two endpoints only. Confirmation deliberately has none: attachments are bound
 * to their parent inside that parent's own create handler, so a file cannot be
 * confirmed against an entity that failed validation.
 *
 * See docs/specs/CC-02-file-storage.md.
 */

import { AttachmentEntity, AttachmentStatus, Role } from "@prisma/client";
import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/database.js";
import { STORAGE_ENABLED } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { AttachmentError, reserveUpload } from "../services/storage/attachments.js";
import { createSignedDownload } from "../services/storage/supabaseStorage.js";
import type { AuthRequest } from "../types/index.js";

/**
 * Two routers, because the two endpoints sit under different prefixes:
 * signing is an action on uploads, downloading is a read of an attachment.
 * Keeping them separate also stops `/uploads/:id` existing by accident.
 */
export const uploadsRouter = Router();
export const attachmentsRouter = Router();

/**
 * Reserve an upload slot and return a URL the browser PUTs the bytes to.
 *
 * Any authenticated role may upload: students attach complaint evidence,
 * faculty and admins attach it to resolutions. What an upload may then be
 * bound to is decided at confirmation, by the parent entity's own handler.
 */
uploadsRouter.post(
  "/sign",
  authenticate,
  uploadLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await reserveUpload({
        entityType: req.body?.entityType,
        mimeType: req.body?.mimeType,
        sizeBytes: req.body?.sizeBytes,
        originalName: req.body?.originalName,
        uploadedById: req.user!.id,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AttachmentError) {
        res.status(error.status).json({ error: error.message });
        return;
      }

      console.error("[CC-02] sign upload failed:", error);
      res.status(500).json({ error: "Could not prepare the upload." });
    }
  },
);

/**
 * May this user see this attachment?
 *
 * Authorization is delegated to the parent entity rather than stored on the
 * attachment: the file inherits whatever visibility its owner has, so the two
 * can never drift apart.
 */
const canRead = async (
  req: AuthRequest,
  entityType: AttachmentEntity,
  entityId: string,
): Promise<boolean> => {
  const { id: userId, role } = req.user!;

  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) return true;

  switch (entityType) {
    case AttachmentEntity.COMPLAINT:
    case AttachmentEntity.COMPLAINT_RESOLUTION: {
      // Complaints are private to the student who raised them and whoever is
      // handling them — unlike doubts, they are not a community feed.
      const complaint = await prisma.complaint.findUnique({
        where: { id: entityId },
        select: { raisedById: true, assignedToId: true },
      });

      if (!complaint) return false;
      return (
        complaint.raisedById === userId || complaint.assignedToId === userId
      );
    }

    case AttachmentEntity.DOUBT:
    case AttachmentEntity.ANSWER:
      // The doubt community is readable by every authenticated member, so an
      // attachment on one is too.
      return true;

    default:
      return false;
  }
};

/** Issue a short-lived signed download URL. */
attachmentsRouter.get(
  "/:id",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id ?? "");

      // Checked before the query: with storage off the table may not exist.
      if (!STORAGE_ENABLED) {
        res.status(503).json({ error: "File storage is not configured." });
        return;
      }

      const attachment = await prisma.attachment.findUnique({ where: { id } });

      if (!attachment) {
        res.status(404).json({ error: "Attachment not found" });
        return;
      }

      // A PENDING row is a reservation, not a file anyone else can see — its
      // uploader is mid-flow and nobody else has a reason to reach it.
      if (attachment.status === AttachmentStatus.PENDING) {
        if (attachment.uploadedById !== req.user!.id) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      } else if (
        !attachment.entityType ||
        !attachment.entityId ||
        !(await canRead(req, attachment.entityType, attachment.entityId))
      ) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const signed = await createSignedDownload(
        attachment.storagePath,
        attachment.originalName,
      );

      res.json({
        id: attachment.id,
        mimeType: attachment.mimeType,
        originalName: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
        ...signed,
      });
    } catch (error) {
      console.error("[CC-02] download signing failed:", error);
      res.status(500).json({ error: "Could not prepare the download." });
    }
  },
);
