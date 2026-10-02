/**
 * Faculty performance statistics (CC-26).
 *
 * Three routes, and the list of who can reach them is the feature:
 *
 *   GET /api/faculty/me/stats         FACULTY      own numbers only
 *   GET /api/admin/faculty/stats      ADMIN, SUPER all faculty, for oversight
 *   GET /api/admin/faculty/:id/stats  ADMIN, SUPER one faculty member (audited)
 *
 * There is no route that shows a named faculty member's numbers to students
 * or to other faculty. See services/faculty/stats.ts for why.
 *
 * Its own controller rather than another 200 lines in facultyController.ts,
 * which is the file CC-72 exists to break up.
 */

import { Role } from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";
import { AuditAction, auditFromRequest } from "../services/audit/auditLog.js";
import {
  computeFacultyStats,
  departmentBenchmark,
  listFaculty,
  parseWindow,
} from "../services/faculty/stats.js";

/** GET /api/faculty/me/stats?days=30|90|365 */
export const getMyStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const days = parseWindow(req.query.days);
    const userId = req.user!.id;

    const profile = await prisma.facultyProfile.findUnique({
      where: { userId },
      select: { department: true },
    });

    const [statsById, benchmark] = await Promise.all([
      computeFacultyStats([userId], days),
      profile ? departmentBenchmark(profile.department, days) : null,
    ]);

    res.json({ days, stats: statsById.get(userId), benchmark });
  } catch (error) {
    console.error("[CC-26] own stats failed:", error);
    res.status(500).json({ error: "Could not load your statistics." });
  }
};

/** GET /api/admin/faculty/stats?days=30|90|365&department=… */
export const getFacultyStatsOverview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const days = parseWindow(req.query.days);
    const department =
      typeof req.query.department === "string" && req.query.department.trim()
        ? req.query.department.trim()
        : undefined;

    const faculty = await listFaculty(department);
    const statsById = await computeFacultyStats(
      faculty.map((member) => member.id),
      days,
    );

    res.json({
      days,
      faculty: faculty.map((member) => ({
        id: member.id,
        name: member.name,
        userID: member.userID,
        department: member.facultyProfile?.department ?? null,
        isTeaching: member.facultyProfile?.isTeaching ?? true,
        stats: statsById.get(member.id),
      })),
    });
  } catch (error) {
    console.error("[CC-26] stats overview failed:", error);
    res.status(500).json({ error: "Could not load faculty statistics." });
  }
};

/** GET /api/admin/faculty/:id/stats?days=30|90|365 */
export const getFacultyStatsForUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const days = parseWindow(req.query.days);
    const id = req.params.id as string;

    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userID: true,
        role: true,
        facultyProfile: { select: { department: true, isTeaching: true } },
      },
    });

    if (!member || member.role !== Role.FACULTY) {
      res.status(404).json({ error: "Faculty member not found." });
      return;
    }

    const [statsById, benchmark] = await Promise.all([
      computeFacultyStats([id], days),
      member.facultyProfile
        ? departmentBenchmark(member.facultyProfile.department, days)
        : null,
    ]);

    await auditFromRequest(req, {
      action: AuditAction.FACULTY_STATS_VIEW,
      targetType: "User",
      targetId: id,
      summary: `Viewed performance statistics for ${member.userID} (${days} days)`,
      metadata: { days },
    });

    res.json({
      days,
      faculty: {
        id: member.id,
        name: member.name,
        userID: member.userID,
        department: member.facultyProfile?.department ?? null,
        isTeaching: member.facultyProfile?.isTeaching ?? true,
      },
      stats: statsById.get(id),
      benchmark,
    });
  } catch (error) {
    console.error("[CC-26] faculty stats failed:", error);
    res.status(500).json({ error: "Could not load statistics." });
  }
};
