/**
 * SLA budgets and deadline arithmetic (CC-31).
 *
 * Pure functions, no database. The sweep and the controllers both go through
 * here so there is exactly one definition of when something is due.
 *
 * See docs/specs/CC-31-sla-escalation.md.
 */

import { ComplaintStatus } from "@prisma/client";
import { SLA_ENABLED, SLA_MULTIPLIER } from "../../config/env.js";

/**
 * Which party a complaint is waiting on.
 *
 * This distinction is the whole correctness argument for the feature. One
 * undifferentiated timer would escalate complaints against staff for the days
 * a student spent not clicking "confirm" - which makes the metric worthless
 * and the escalation unfair.
 */
export type Clock = "assignment" | "resolution" | "student" | "none";

export const clockFor = (status: ComplaintStatus): Clock => {
  switch (status) {
    case ComplaintStatus.RAISED:
      // Waiting on an admin to assign it.
      return "assignment";
    case ComplaintStatus.ASSIGNED:
    case ComplaintStatus.IN_PROGRESS:
      // Waiting on the assignee to fix it.
      return "resolution";
    case ComplaintStatus.PENDING_CONFIRMATION:
      // Waiting on the student. Reminders, never escalation.
      return "student";
    case ComplaintStatus.ESCALATED_TO_SUPERADMIN:
    case ComplaintStatus.RESOLVED:
    default:
      // Already at the top, or finished.
      return "none";
  }
};

/**
 * Hours allowed, by priority.
 *
 * PRIORITY RUNS 1 (LOW) TO 5 (CRITICAL), matching the form the student sees
 * and the values already in the database. CC-14 records a bug from assuming
 * this backwards, which would file "sparking socket" as the most relaxed
 * deadline on the board.
 *
 * These are DEFAULTS, NOT MEASUREMENTS. Nobody has resolution-time data yet.
 * They are plausible starting points, tunable through SLA_MULTIPLIER without a
 * deploy, and worth replacing with real percentiles once the data exists.
 */
const BUDGET_HOURS: Record<number, { assignment: number; resolution: number }> = {
  5: { assignment: 4, resolution: 24 },
  4: { assignment: 8, resolution: 48 },
  3: { assignment: 24, resolution: 96 },
  2: { assignment: 48, resolution: 168 },
  1: { assignment: 72, resolution: 240 },
};

/** Unknown or out-of-range priorities fall back to Medium rather than to none. */
const budgetFor = (priority: number) =>
  BUDGET_HOURS[priority] ?? BUDGET_HOURS[3]!;

export const budgetHours = (
  priority: number,
  clock: "assignment" | "resolution",
): number => budgetFor(priority)[clock] * SLA_MULTIPLIER;

/**
 * The deadline for a complaint in this state, or null when no staff clock is
 * running.
 *
 * Returns null for the student and none clocks: a NULL slaDueAt is what the
 * sweep reads as "not staff's move".
 */
export const computeSlaDueAt = (
  status: ComplaintStatus,
  priority: number,
  from: Date = new Date(),
): Date | null => {
  if (!SLA_ENABLED) return null;

  const clock = clockFor(status);
  if (clock !== "assignment" && clock !== "resolution") return null;

  return new Date(from.getTime() + budgetHours(priority, clock) * 3_600_000);
};

/** Deadline for a newly filed complaint. Always the assignment clock. */
export const initialSlaDueAt = (priority: number, from?: Date): Date | null =>
  computeSlaDueAt(ComplaintStatus.RAISED, priority, from);

/**
 * How the deadline should change when a complaint moves status.
 *
 * Returned as a patch rather than applied here, so callers can fold it into
 * an update they were already making.
 */
export const slaPatchForStatus = (
  status: ComplaintStatus,
  priority: number,
  from?: Date,
): { slaDueAt: Date | null } => ({
  slaDueAt: computeSlaDueAt(status, priority, from),
});

export const isOverdue = (
  slaDueAt: Date | null | undefined,
  now: Date = new Date(),
): boolean => Boolean(slaDueAt && slaDueAt.getTime() <= now.getTime());

/** Hours past the deadline, for the message a human reads. */
export const hoursOverdue = (
  slaDueAt: Date,
  now: Date = new Date(),
): number =>
  Math.max(0, Math.floor((now.getTime() - slaDueAt.getTime()) / 3_600_000));
