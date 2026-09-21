/**
 * Retention limits (CC-64).
 *
 * Purpose limitation means not keeping things past the point they are useful.
 * This deletes the genuinely ephemeral tables on a schedule.
 *
 * See docs/specs/CC-64-dpdp.md.
 */

import { EmailStatus } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  RETENTION_DOUBT_VIEW_DAYS,
  RETENTION_EMAIL_FAILED_DAYS,
  RETENTION_EMAIL_SENT_DAYS,
  RETENTION_ENABLED,
  RETENTION_NOTIFICATION_DAYS,
} from "../../config/env.js";

export interface RetentionResult {
  notifications: number;
  doubtViews: number;
  sentEmails: number;
  failedEmails: number;
}

const cutoff = (days: number): Date =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Delete what is past its limit.
 *
 * WHAT IS DELIBERATELY ABSENT MATTERS MORE THAN WHAT IS HERE.
 *
 * Complaints, doubts, answers and audit rows are on no timer at all.
 * Complaints are the record of the institution's own conduct, and a
 * complaints system that quietly deletes complaints after a year has the one
 * failure mode it cannot have. Doubts and answers are other people's work.
 * The audit log is the thing CC-61 exists to preserve.
 *
 * Only rows that are purely mechanical - a read bell item, a view counter
 * entry, a delivery receipt - are on a clock.
 */
export const runRetentionSweep = async (): Promise<RetentionResult> => {
  const result: RetentionResult = {
    notifications: 0,
    doubtViews: 0,
    sentEmails: 0,
    failedEmails: 0,
  };

  if (!RETENTION_ENABLED) return result;

  const notifications = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff(RETENTION_NOTIFICATION_DAYS) } },
  });
  result.notifications = notifications.count;

  const views = await prisma.doubtView.deleteMany({
    where: { viewedAt: { lt: cutoff(RETENTION_DOUBT_VIEW_DAYS) } },
  });
  result.doubtViews = views.count;

  // Sent mail is delivery evidence, and the body holds personal data.
  const sent = await prisma.emailOutbox.deleteMany({
    where: {
      status: EmailStatus.SENT,
      createdAt: { lt: cutoff(RETENTION_EMAIL_SENT_DAYS) },
    },
  });
  result.sentEmails = sent.count;

  // Failures are kept longer: diagnosing "why did nothing arrive" needs the
  // history, and a parked row is the only record that it was ever attempted.
  const failed = await prisma.emailOutbox.deleteMany({
    where: {
      status: EmailStatus.FAILED,
      createdAt: { lt: cutoff(RETENTION_EMAIL_FAILED_DAYS) },
    },
  });
  result.failedEmails = failed.count;

  return result;
};
