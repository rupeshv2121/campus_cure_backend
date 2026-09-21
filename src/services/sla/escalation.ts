/**
 * The nightly SLA sweep (CC-31).
 *
 * Finds complaints whose deadline has passed, tells the people responsible,
 * and escalates the ones that keep passing it.
 *
 * Notifications go through `createNotification`, so CC-40 emails them for free
 * and this module never learns that email exists.
 *
 * See docs/specs/CC-31-sla-escalation.md.
 */

import { ComplaintStatus, NotificationType, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  SLA_CONFIRMATION_REMINDER_HOURS,
  SLA_ENABLED,
  SLA_ESCALATION_COOLDOWN_HOURS,
  SLA_MAX_ESCALATIONS,
  SLA_SWEEP_BATCH_SIZE,
} from "../../config/env.js";
import { createNotification } from "../../utils/notifications.js";
import { clockFor, computeSlaDueAt, hoursOverdue } from "./policy.js";

export interface SweepResult {
  examined: number;
  escalated: number;
  escalatedToSuperAdmin: number;
  reminded: number;
  skippedCooldown: number;
  errors: number;
}

const emptyResult = (): SweepResult => ({
  examined: 0,
  escalated: 0,
  escalatedToSuperAdmin: 0,
  reminded: 0,
  skippedCooldown: 0,
  errors: 0,
});

/** Has this complaint been escalated recently enough to leave alone? */
const inCooldown = (lastEscalationAt: Date | null, now: Date): boolean => {
  if (!lastEscalationAt) return false;

  const elapsedHours =
    (now.getTime() - lastEscalationAt.getTime()) / 3_600_000;

  return elapsedHours < SLA_ESCALATION_COOLDOWN_HOURS;
};

/** Who should hear about an overdue complaint, besides its assignee. */
const findAdmins = async (superAdminOnly: boolean): Promise<string[]> => {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: superAdminOnly
        ? Role.SUPER_ADMIN
        : { in: [Role.ADMIN, Role.SUPER_ADMIN] },
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
};

/**
 * Notify without letting one failure abort the sweep.
 *
 * A notification problem must not leave the remaining complaints unexamined —
 * the sweep runs once a day, so "threw on complaint three" means complaints
 * four onward wait another 24 hours.
 */
const notifyQuietly = async (
  params: Parameters<typeof createNotification>[0],
): Promise<boolean> => {
  try {
    await createNotification(params);
    return true;
  } catch (error) {
    console.error(
      `[CC-31] notification failed for ${params.userId}:`,
      (error as Error).message,
    );
    return false;
  }
};

interface OverdueComplaint {
  id: string;
  title: string;
  status: ComplaintStatus;
  priority: number;
  raisedById: string;
  assignedToId: string | null;
  escalationCount: number;
  slaDueAt: Date | null;
  lastEscalationAt: Date | null;
}

/**
 * Escalate one complaint that staff have run out of time on.
 *
 * The ladder: each breach bumps the counter and tells whoever is responsible;
 * once the counter reaches SLA_MAX_ESCALATIONS the complaint moves to the
 * super admin, which is the top - nothing escalates past it.
 */
const escalate = async (
  complaint: OverdueComplaint,
  now: Date,
  result: SweepResult,
): Promise<void> => {
  const escalationCount = complaint.escalationCount + 1;
  const toSuperAdmin = escalationCount >= SLA_MAX_ESCALATIONS;
  const overdueBy = complaint.slaDueAt
    ? hoursOverdue(complaint.slaDueAt, now)
    : 0;

  await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      escalationCount,
      lastEscalationAt: now,
      ...(toSuperAdmin
        ? {
            status: ComplaintStatus.ESCALATED_TO_SUPERADMIN,
            // No staff clock runs at the top of the ladder.
            slaDueAt: null,
          }
        : {
            // Push the deadline out by the cooldown so the next sweep does not
            // re-fire on the same complaint immediately.
            slaDueAt: new Date(
              now.getTime() + SLA_ESCALATION_COOLDOWN_HOURS * 3_600_000,
            ),
          }),
    },
    select: { id: true },
  });

  const clock = clockFor(complaint.status);
  const waitingOn =
    clock === "assignment" ? "has not been assigned" : "has not been resolved";

  const recipients = new Set<string>();

  if (toSuperAdmin) {
    for (const id of await findAdmins(true)) recipients.add(id);
  } else if (clock === "assignment") {
    // Nobody owns it yet, so the admins who could assign it are told.
    for (const id of await findAdmins(false)) recipients.add(id);
  } else {
    // The assignee is the one sitting on it; admins are told too, because an
    // assignee who is ignoring the app will ignore one more notification.
    if (complaint.assignedToId) recipients.add(complaint.assignedToId);
    for (const id of await findAdmins(false)) recipients.add(id);
  }

  const title = toSuperAdmin
    ? "Complaint escalated to Super Admin"
    : "Complaint is overdue";

  const message = toSuperAdmin
    ? `"${complaint.title}" ${waitingOn} and has breached its deadline ${escalationCount} times. It has been escalated to the Super Admin.`
    : `"${complaint.title}" ${waitingOn} and is ${overdueBy}h past its deadline.`;

  for (const userId of recipients) {
    const ok = await notifyQuietly({
      userId,
      type: NotificationType.COMPLAINT_STATUS_UPDATE,
      title,
      message,
      data: {
        complaintId: complaint.id,
        escalationCount,
        overdueHours: overdueBy,
        sla: true,
      },
    });
    if (!ok) result.errors += 1;
  }

  result.escalated += 1;
  if (toSuperAdmin) result.escalatedToSuperAdmin += 1;
};

/**
 * Remind a student to confirm a resolution.
 *
 * Deliberately does NOT touch escalationCount. A complaint waiting on the
 * reporter is not a staff failure, and counting it as one makes the metric the
 * admin queue sorts by dishonest.
 *
 * It also never auto-resolves. Closing someone's complaint on their behalf to
 * make a number look better is how a system teaches people it lies.
 */
const remind = async (
  complaint: OverdueComplaint,
  now: Date,
  result: SweepResult,
): Promise<void> => {
  await prisma.complaint.update({
    where: { id: complaint.id },
    data: { lastEscalationAt: now },
    select: { id: true },
  });

  const ok = await notifyQuietly({
    userId: complaint.raisedById,
    type: NotificationType.COMPLAINT_STATUS_UPDATE,
    title: "Please confirm your complaint was resolved",
    message: `"${complaint.title}" was marked resolved and is waiting for your confirmation. If it is not fixed, you can reject the resolution.`,
    data: { complaintId: complaint.id, reminder: true },
  });

  if (ok) result.reminded += 1;
  else result.errors += 1;
};

/**
 * One pass over everything that is overdue.
 *
 * Runs from the consolidated daily cron. Granularity is therefore one day:
 * the breach TIME is exact, because it comes from stored timestamps, but the
 * REACTION waits for the next run. Vercel's Hobby plan caps cron frequency,
 * which is why the project already consolidated its jobs into one.
 */
export const runSlaSweep = async (): Promise<SweepResult> => {
  const result = emptyResult();

  if (!SLA_ENABLED) return result;

  const now = new Date();

  const overdue = (await prisma.complaint.findMany({
    where: {
      status: {
        in: [
          ComplaintStatus.RAISED,
          ComplaintStatus.ASSIGNED,
          ComplaintStatus.IN_PROGRESS,
        ],
      },
      slaDueAt: { not: null, lte: now },
    },
    orderBy: { slaDueAt: "asc" },
    take: SLA_SWEEP_BATCH_SIZE,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      raisedById: true,
      assignedToId: true,
      escalationCount: true,
      slaDueAt: true,
      lastEscalationAt: true,
    },
  })) as OverdueComplaint[];

  for (const complaint of overdue) {
    result.examined += 1;

    if (inCooldown(complaint.lastEscalationAt, now)) {
      result.skippedCooldown += 1;
      continue;
    }

    try {
      await escalate(complaint, now, result);
    } catch (error) {
      result.errors += 1;
      console.error(
        `[CC-31] escalation failed for ${complaint.id}:`,
        (error as Error).message,
      );
    }
  }

  await remindPendingConfirmations(now, result);

  return result;
};

/**
 * Students sitting on a resolution they have not confirmed.
 *
 * Queried separately from the escalation pass because the selection is
 * different - it keys off pendingConfirmationAt rather than slaDueAt, which is
 * null for this status precisely because staff are not the blocker.
 */
const remindPendingConfirmations = async (
  now: Date,
  result: SweepResult,
): Promise<void> => {
  const cutoff = new Date(
    now.getTime() - SLA_CONFIRMATION_REMINDER_HOURS * 3_600_000,
  );

  const waiting = (await prisma.complaint.findMany({
    where: {
      status: ComplaintStatus.PENDING_CONFIRMATION,
      pendingConfirmationAt: { not: null, lte: cutoff },
    },
    orderBy: { pendingConfirmationAt: "asc" },
    take: SLA_SWEEP_BATCH_SIZE,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      raisedById: true,
      assignedToId: true,
      escalationCount: true,
      slaDueAt: true,
      lastEscalationAt: true,
    },
  })) as OverdueComplaint[];

  for (const complaint of waiting) {
    result.examined += 1;

    if (inCooldown(complaint.lastEscalationAt, now)) {
      result.skippedCooldown += 1;
      continue;
    }

    try {
      await remind(complaint, now, result);
    } catch (error) {
      result.errors += 1;
      console.error(
        `[CC-31] reminder failed for ${complaint.id}:`,
        (error as Error).message,
      );
    }
  }
};

/** What is due, and what has already slipped. For the admin view and demos. */
export const getSlaStats = async () => {
  if (!SLA_ENABLED) return { enabled: false };

  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3_600_000);

  const [overdue, dueSoon, escalated, atTop] = await Promise.all([
    prisma.complaint.count({
      where: {
        status: {
          in: [
            ComplaintStatus.RAISED,
            ComplaintStatus.ASSIGNED,
            ComplaintStatus.IN_PROGRESS,
          ],
        },
        slaDueAt: { not: null, lte: now },
      },
    }),
    prisma.complaint.count({
      where: { slaDueAt: { gt: now, lte: soon } },
    }),
    prisma.complaint.count({ where: { escalationCount: { gt: 0 } } }),
    prisma.complaint.count({
      where: { status: ComplaintStatus.ESCALATED_TO_SUPERADMIN },
    }),
  ]);

  return { enabled: true, overdue, dueSoon, everEscalated: escalated, atTop };
};

/** Exposed for the backfill script and tests. */
export const deadlineFor = computeSlaDueAt;
