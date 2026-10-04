/**
 * Complaints assigned to a faculty member or member of staff.
 *
 * Split out of facultyController.ts by CC-72. Stage 2 moved the business rules for the
 * thin handlers here into services/ (complaints/ or doubts/); they now only
 * translate HTTP in and errors out.
 * See docs/specs/CC-72-controller-split.md.
 */

import type { Response } from "express";
import { prisma } from "../../config/database.js";
import { changeComplaintStatus } from "../../services/complaints/lifecycle.js";
import {
  withEvidence
} from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest } from "../../types/index.js";
import { answerComplaintError } from "../complaintErrors.js";

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
    const { status, resolutionNote, resolutionAttachmentIds } = req.body;

    // CC-72: the rules live in services/complaints/lifecycle.ts.
    await changeComplaintStatus({
      complaintId: req.params.complaintId as string,
      to: status,
      resolutionNote,
      resolutionAttachmentIds,
      actor: { kind: "staff", userId: req.user!.id },
    });

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
    console.error("Update complaint status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
