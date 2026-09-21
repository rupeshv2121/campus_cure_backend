/**
 * CC-31: which clock is running, and for how long.
 *
 * The clock selection is the correctness argument for the whole feature. One
 * undifferentiated timer would escalate complaints against staff for the days
 * a student spent not clicking "confirm".
 */
import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ SLA_ENABLED: true, SLA_MULTIPLIER: 1 }));

vi.mock("../../config/env.js", () => env);

import {
  budgetHours,
  clockFor,
  computeSlaDueAt,
  hoursOverdue,
  initialSlaDueAt,
  isOverdue,
  slaPatchForStatus,
} from "../../services/sla/policy.js";

const hoursBetween = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / 3_600_000;

describe("clockFor", () => {
  it("puts an unassigned complaint on the admin", () => {
    expect(clockFor("RAISED")).toBe("assignment");
  });

  it("puts an assigned complaint on the assignee", () => {
    expect(clockFor("ASSIGNED")).toBe("resolution");
    expect(clockFor("IN_PROGRESS")).toBe("resolution");
  });

  it("puts a pending confirmation on the student, never on staff", () => {
    // The distinction the whole feature rests on.
    expect(clockFor("PENDING_CONFIRMATION")).toBe("student");
  });

  it("runs no clock at the top of the ladder or at the end", () => {
    expect(clockFor("ESCALATED_TO_SUPERADMIN")).toBe("none");
    expect(clockFor("RESOLVED")).toBe("none");
  });
});

describe("budgetHours", () => {
  it("treats 5 as the most urgent and 1 as the least", () => {
    // Priority runs 1 (Low) to 5 (Critical). CC-14 records a bug from
    // assuming this backwards, which would file a sparking socket as Low.
    expect(budgetHours(5, "assignment")).toBeLessThan(
      budgetHours(1, "assignment"),
    );
    expect(budgetHours(5, "resolution")).toBeLessThan(
      budgetHours(1, "resolution"),
    );
  });

  it("allows longer to fix than to assign, at every priority", () => {
    for (const priority of [1, 2, 3, 4, 5]) {
      expect(budgetHours(priority, "resolution")).toBeGreaterThan(
        budgetHours(priority, "assignment"),
      );
    }
  });

  it("falls back to Medium for an out-of-range priority", () => {
    expect(budgetHours(99, "assignment")).toBe(budgetHours(3, "assignment"));
    expect(budgetHours(0, "assignment")).toBe(budgetHours(3, "assignment"));
  });

  it("scales with the multiplier", () => {
    env.SLA_MULTIPLIER = 2;
    expect(budgetHours(3, "assignment")).toBe(48);
    env.SLA_MULTIPLIER = 1;
  });
});

describe("computeSlaDueAt", () => {
  const from = new Date("2026-09-21T00:00:00Z");

  it("sets a deadline for a staff clock", () => {
    const due = computeSlaDueAt("RAISED", 5, from);

    expect(due).toBeInstanceOf(Date);
    expect(hoursBetween(from, due as Date)).toBe(4);
  });

  it("gives a critical complaint less time than a low one", () => {
    const critical = computeSlaDueAt("RAISED", 5, from) as Date;
    const low = computeSlaDueAt("RAISED", 1, from) as Date;

    expect(critical.getTime()).toBeLessThan(low.getTime());
  });

  it("returns null when the student is the blocker", () => {
    expect(computeSlaDueAt("PENDING_CONFIRMATION", 5, from)).toBeNull();
  });

  it("returns null once resolved or escalated to the top", () => {
    expect(computeSlaDueAt("RESOLVED", 5, from)).toBeNull();
    expect(computeSlaDueAt("ESCALATED_TO_SUPERADMIN", 5, from)).toBeNull();
  });

  it("returns null with the feature switched off", () => {
    env.SLA_ENABLED = false;
    expect(computeSlaDueAt("RAISED", 5, from)).toBeNull();
    env.SLA_ENABLED = true;
  });

  it("gives a newly filed complaint the assignment budget", () => {
    const due = initialSlaDueAt(3, from) as Date;

    expect(hoursBetween(from, due)).toBe(budgetHours(3, "assignment"));
  });

  it("resets to the resolution budget on assignment", () => {
    const raised = computeSlaDueAt("RAISED", 3, from) as Date;
    const assigned = computeSlaDueAt("ASSIGNED", 3, from) as Date;

    expect(assigned.getTime()).toBeGreaterThan(raised.getTime());
  });
});

describe("slaPatchForStatus", () => {
  it("clears the deadline when staff stop being the blocker", () => {
    expect(slaPatchForStatus("PENDING_CONFIRMATION", 3)).toEqual({
      slaDueAt: null,
    });
    expect(slaPatchForStatus("RESOLVED", 3)).toEqual({ slaDueAt: null });
  });

  it("sets one when staff become the blocker again", () => {
    expect(slaPatchForStatus("IN_PROGRESS", 3).slaDueAt).toBeInstanceOf(Date);
  });
});

describe("isOverdue / hoursOverdue", () => {
  const now = new Date("2026-09-21T12:00:00Z");

  it("is not overdue before the deadline, or without one", () => {
    expect(isOverdue(new Date("2026-09-21T13:00:00Z"), now)).toBe(false);
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue(undefined, now)).toBe(false);
  });

  it("is overdue at and after the deadline", () => {
    expect(isOverdue(now, now)).toBe(true);
    expect(isOverdue(new Date("2026-09-21T11:00:00Z"), now)).toBe(true);
  });

  it("reports whole hours past the deadline, never negative", () => {
    expect(hoursOverdue(new Date("2026-09-21T09:30:00Z"), now)).toBe(2);
    expect(hoursOverdue(new Date("2026-09-21T18:00:00Z"), now)).toBe(0);
  });
});
