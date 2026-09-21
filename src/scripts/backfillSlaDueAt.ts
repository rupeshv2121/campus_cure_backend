/**
 * CC-31: start the SLA clock on complaints that predate it.
 *
 * Every existing complaint has slaDueAt = NULL, which reads as "no clock
 * running" - so the feature ships inert until this runs.
 *
 * THE FLOOR IS THE POINT. Deriving deadlines honestly from each complaint's
 * original timestamps would make every old complaint instantly overdue, and
 * the first sweep would escalate the entire history overnight. A system that
 * has never had SLAs starts its clock today; it does not declare its past a
 * failure. So every backfilled deadline is at least 24 hours out.
 *
 *   npx tsx src/scripts/backfillSlaDueAt.ts          # dry run
 *   npx tsx src/scripts/backfillSlaDueAt.ts --apply
 */

import "dotenv/config";
import { ComplaintStatus } from "@prisma/client";
import { prisma } from "../config/database.js";
import { SLA_ENABLED } from "../config/env.js";
import { clockFor, computeSlaDueAt } from "../services/sla/policy.js";

const apply = process.argv.includes("--apply");

/** No backfilled complaint may be due sooner than this. */
const FLOOR_HOURS = 24;

const main = async (): Promise<void> => {
  if (!SLA_ENABLED) {
    console.error("SLA_ENABLED is false, so there are no clocks to start.");
    process.exitCode = 1;
    return;
  }

  const complaints = await prisma.complaint.findMany({
    where: {
      slaDueAt: null,
      status: {
        in: [
          ComplaintStatus.RAISED,
          ComplaintStatus.ASSIGNED,
          ComplaintStatus.IN_PROGRESS,
        ],
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      assignedAt: true,
    },
  });

  console.log(`${complaints.length} complaint(s) with a staff clock to start.`);

  const now = new Date();
  const floor = new Date(now.getTime() + FLOOR_HOURS * 3_600_000);
  let floored = 0;

  const planned = complaints.map((complaint) => {
    // Measure from when the current wait actually began, so a complaint
    // assigned yesterday is not treated as if it were filed today.
    const startedAt =
      clockFor(complaint.status) === "resolution"
        ? (complaint.assignedAt ?? complaint.createdAt)
        : complaint.createdAt;

    const natural = computeSlaDueAt(
      complaint.status,
      complaint.priority,
      startedAt,
    );

    const due = !natural || natural < floor ? floor : natural;
    if (due === floor) floored += 1;

    return { complaint, due };
  });

  console.log(
    `${floored} would already be overdue on their original timeline and are ` +
      `floored to ${FLOOR_HOURS}h from now.`,
  );

  if (!apply) {
    for (const { complaint, due } of planned.slice(0, 10)) {
      console.log(
        `  ${complaint.status.padEnd(12)} p${complaint.priority}  ` +
          `${due.toISOString()}  ${complaint.title.slice(0, 40)}`,
      );
    }
    if (planned.length > 10) console.log(`  ... and ${planned.length - 10} more`);
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }

  for (const { complaint, due } of planned) {
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { slaDueAt: due },
      select: { id: true },
    });
  }

  console.log(`\nStarted the clock on ${planned.length} complaint(s).`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The pg pool keeps the process alive otherwise; see the CC-03 spec note.
  .finally(() => process.exit(process.exitCode ?? 0));
