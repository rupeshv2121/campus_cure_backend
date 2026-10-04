/**
 * Filing a complaint (CC-72 stage 2).
 *
 * One transaction: the complaint, the student's counters, and the photos
 * they attached all commit together or not at all. Embedding for duplicate
 * detection (CC-13) is queued afterwards, never inline - an AI outage must
 * not stop anyone reporting a broken fan.
 *
 * Changed in the move:
 *  - priority is validated (an integer 1-5). It used to reach the database
 *    as whatever the client sent, and a bad value came back as a 500;
 *  - the complaint's full text is no longer written to the server log.
 */

import { AttachmentEntity, type Complaint } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { requestEmbedding, triggerDrainInBackground } from "../ai/embeddingWorker.js";
import { getPostingSettings } from "../settings/posting.js";
import { initialSlaDueAt } from "../sla/policy.js";
import { confirmAttachments } from "../storage/attachments.js";
import { ComplaintError } from "./lifecycle.js";

export interface ComplaintInput {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  priority?: unknown;
  classroomNumber?: unknown;
  block?: unknown;
  attachmentIds?: unknown;
}

/** Validate and normalise what the form sent. Pure apart from the category list. */
export const validateComplaint = (input: ComplaintInput, allowedCategories: string[]) => {
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const fields = {
    title: text(input.title),
    description: text(input.description),
    category: text(input.category),
    classroomNumber: text(input.classroomNumber),
    block: text(input.block),
  };

  if (Object.values(fields).some((value) => !value) || input.priority === undefined || input.priority === null || input.priority === "") {
    throw new ComplaintError("All fields are required", 400);
  }

  const priority = Number(input.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new ComplaintError("Priority must be a whole number from 1 to 5", 400);
  }

  if (!allowedCategories.includes(fields.category)) {
    throw new ComplaintError("Selected complaint category is not allowed", 400);
  }

  return { ...fields, priority };
};

/**
 * File a complaint for a student. Throws ComplaintError for bad input and
 * lets AttachmentError through (a rejected photo rolls the whole filing back).
 */
export const fileComplaint = async (studentId: string, input: ComplaintInput): Promise<Complaint> => {
  const { allowedCategories } = await getPostingSettings();
  const fields = validateComplaint(input, allowedCategories);

  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        ...fields,
        // CC-31: the clock starts the moment it is filed, on the assignment
        // budget - until someone assigns it, an admin is the one holding it.
        slaDueAt: initialSlaDueAt(fields.priority),
        raisedBy: { connect: { id: studentId } },
      },
    });

    await tx.studentProfile.update({
      where: { userId: studentId },
      data: {
        totalComplaints: { increment: 1 },
        totalActiveComplaints: { increment: 1 },
      },
    });

    // CC-02: inside the transaction, so a rejected photo means no complaint
    // was filed rather than a complaint pointing at files it does not have.
    if (Array.isArray(input.attachmentIds) && input.attachmentIds.length > 0) {
      await confirmAttachments({
        attachmentIds: input.attachmentIds,
        entityType: AttachmentEntity.COMPLAINT,
        entityId: created.id,
        userId: studentId,
        tx,
      });
    }

    return created;
  });

  // CC-13: matched against future reports. requestEmbedding does not throw.
  await requestEmbedding("complaint", complaint.id);
  triggerDrainInBackground();

  return complaint;
};
