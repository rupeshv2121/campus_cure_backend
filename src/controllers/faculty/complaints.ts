/**
 * Complaints assigned to a faculty member or member of staff.
 *
 * Split out of facultyController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ComplaintStatus,
  Prisma
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import { computeSlaDueAt } from "../../services/sla/policy.js";
import {
  AttachmentError
} from "../../services/storage/attachments.js";
import {
  attachResolutionEvidence,
  withEvidence,
} from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest } from "../../types/index.js";
import {
  notifyComplaintStatusChange
} from "../../utils/notifications.js";

// 4. Get Complaints Assigned to Faculty
export const assignedComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const facultyId = req.user!.id;

    // Show complaints assigned to this faculty currently or at any point in assignment history.
    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [
          { assignedToId: facultyId },
          {
            assignmentHistory: {
              array_contains: [{ fromAssigneeId: facultyId }],
            },
          },
        ],
      },
      include: {
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            facultyProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // CC-30: the photograph is the point. A faculty member assigned "the
    // third-row chair in ML02 is broken" previously had the text and nothing
    // else, which is precisely the round trip this feature removes.
    res.json({ complaints: await withEvidence(complaints) });
  } catch (error) {
    console.error("Get assigned complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Complaint Status (Faculty only - can update to IN_PROGRESS or PENDING_CONFIRMATION)
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { status, resolutionNote, resolutionAttachmentIds } = req.body;

    if (!complaintId || !status) {
      res.status(400).json({ error: "Complaint ID and status are required" });
      return;
    }

    // Faculty can only move to IN_PROGRESS or PENDING_CONFIRMATION
    const validFacultyStatuses = ["IN_PROGRESS", "PENDING_CONFIRMATION"];
    if (!validFacultyStatuses.includes(status)) {
      res.status(400).json({
        error:
          "Faculty can only update status to IN_PROGRESS or PENDING_CONFIRMATION",
      });
      return;
    }

    // Verify complaint exists and is assigned to this faculty
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.assignedToId !== req.user!.id) {
      res.status(403).json({
        error: "This complaint is assigned to another faculty member",
      });
      return;
    }

    if (complaint.status === "RESOLVED") {
      res.status(400).json({
        error: "Resolved complaints cannot be updated",
      });
      return;
    }

    // Update complaint status
    const updateData: any = {
      status,
    };

    // Add resolution note if provided
    if (resolutionNote) {
      updateData.resolutionNote = resolutionNote;
    }

    // Set confirmation timing when marking as PENDING_CONFIRMATION.
    if (status === "PENDING_CONFIRMATION") {
      updateData.resolutionDate = new Date();
      updateData.pendingConfirmationAt = new Date();
      // Reset handledBySuperAdmin flag when faculty provides new resolution
      updateData.handledBySuperAdmin = false;
    } else {
      // If complaint moves back to IN_PROGRESS, clear stale pending timestamp.
      updateData.pendingConfirmationAt = null;
    }

    // CC-31: the deadline follows whoever is actually holding the complaint.
    // PENDING_CONFIRMATION and RESOLVED mean staff are no longer the blocker,
    // so the clock stops - a student who takes a week to confirm must never
    // count as a staff SLA breach.
    updateData.slaDueAt = computeSlaDueAt(
      status as ComplaintStatus,
      complaint.priority,
    );

    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });
    } catch (updateError) {
      // Backward compatibility: if DB migration for timestamp columns is pending,
      // retry without the new timestamp field so status updates still work.
      if (
        updateError instanceof Prisma.PrismaClientKnownRequestError &&
        updateError.code === "P2022"
      ) {
        const { pendingConfirmationAt: _ignored, ...fallbackData } = updateData;
        await prisma.complaint.update({
          where: { id: complaintId },
          data: fallbackData,
        });
      } else {
        throw updateError;
      }
    }

    // CC-30: bind the "after" photos now the status change has committed.
    //
    // After the update rather than inside it: confirmAttachments performs a
    // network round trip per file to check each object's real size, and a
    // transaction held open across that is a transaction held open across a
    // third party's latency. The cost of this ordering is that a failure here
    // leaves the status changed and the photos unbound - which the nightly
    // sweep collects, and which is strictly better than a complaint that
    // cannot be resolved because storage was slow.
    try {
      await attachResolutionEvidence({
        attachmentIds: resolutionAttachmentIds,
        complaintId,
        userId: req.user!.id,
        status,
      });
    } catch (evidenceError) {
      if (evidenceError instanceof AttachmentError) {
        res.status(evidenceError.status).json({ error: evidenceError.message });
        return;
      }
      throw evidenceError;
    }

    // Send notification for status change
    try {
      if (complaint.status !== status) {
        await notifyComplaintStatusChange(
          complaint.raisedById,
          complaint.title,
          complaint.status,
          status,
          complaintId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    console.error("Update complaint status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
