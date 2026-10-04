/**
 * One answer for every complaint-lifecycle refusal (CC-72 stage 2), so the
 * staff, admin and student controllers cannot drift in how they report the
 * same rule.
 */
import type { Response } from "express";
import { ComplaintError } from "../services/complaints/lifecycle.js";
import { AttachmentError } from "../services/storage/attachments.js";

/** Map a lifecycle refusal or a rejected photo to its HTTP answer; false if neither. */
export const answerComplaintError = (res: Response, error: unknown): boolean => {
  if (error instanceof ComplaintError || error instanceof AttachmentError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
};
