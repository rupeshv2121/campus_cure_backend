/**
 * Super-admin system settings and the audit log.
 *
 * Split out of adminController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  AdminLevel
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  AuditAction,
  auditFromRequest,
  queryAuditLog,
} from "../../services/audit/auditLog.js";
import type { AuthRequest } from "../../types/index.js";
import { DEFAULT_ALLOWED_CATEGORIES, DEFAULT_DEPARTMENTS, getDoubtSubjectsByUserId, sanitizeStringArray, setDoubtSubjectsByUserId } from "./shared.js";

// Super Admin: Get editable system settings
export const getSuperAdminSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.adminProfile.findUnique({
      where: { userId: req.user!.id },
      select: {
        assignedDepartments: true,
        allowedCategories: true,
      },
    });

    const doubtSubjects = await getDoubtSubjectsByUserId(req.user!.id);

    res.json({
      settings: {
        departments:
          profile && profile.assignedDepartments.length > 0
            ? profile.assignedDepartments
            : DEFAULT_DEPARTMENTS,
        allowedCategories:
          profile && profile.allowedCategories.length > 0
            ? profile.allowedCategories
            : DEFAULT_ALLOWED_CATEGORIES,
        doubtSubjects,
      },
    });
  } catch (error) {
    console.error("Get super admin settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Super Admin: Update editable system settings
export const updateSuperAdminSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { departments, allowedCategories, doubtSubjects } = req.body as {
      departments?: unknown;
      allowedCategories?: unknown;
      doubtSubjects?: unknown;
    };

    if (
      !Array.isArray(departments) ||
      !Array.isArray(allowedCategories) ||
      !Array.isArray(doubtSubjects)
    ) {
      res.status(400).json({
        error:
          "Departments, allowed categories and doubt subjects must be arrays",
      });
      return;
    }

    const sanitizedDepartments = sanitizeStringArray(departments);
    const sanitizedAllowedCategories = sanitizeStringArray(allowedCategories);
    const sanitizedDoubtSubjects = sanitizeStringArray(doubtSubjects);

    if (sanitizedDepartments.length === 0) {
      res.status(400).json({ error: "At least one department is required" });
      return;
    }

    if (sanitizedAllowedCategories.length === 0) {
      res
        .status(400)
        .json({ error: "At least one complaint category is required" });
      return;
    }

    if (sanitizedDoubtSubjects.length === 0) {
      res.status(400).json({ error: "At least one doubt subject is required" });
      return;
    }

    const existingProfile = await prisma.adminProfile.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });

    const profile = existingProfile
      ? await prisma.adminProfile.update({
          where: { userId: req.user!.id },
          data: {
            assignedDepartments: sanitizedDepartments,
            allowedCategories: sanitizedAllowedCategories,
          },
          select: {
            assignedDepartments: true,
            allowedCategories: true,
          },
        })
      : await prisma.adminProfile.create({
          data: {
            userId: req.user!.id,
            adminLevel: AdminLevel.SUPER,
            manageUsers: true,
            manageComplaints: true,
            manageDoubts: true,
            viewAnalytics: true,
            assignedDepartments: sanitizedDepartments,
            allowedCategories: sanitizedAllowedCategories,
          },
          select: {
            assignedDepartments: true,
            allowedCategories: true,
          },
        });

    await setDoubtSubjectsByUserId(req.user!.id, sanitizedDoubtSubjects);

    // Policy change: this decides what every student may file a complaint
    // about, and which subjects a doubt can be posted under.
    await auditFromRequest(req, {
      action: AuditAction.SETTINGS_UPDATE,
      targetType: "Settings",
      summary: "Updated campus-wide posting settings",
      metadata: {
        departments: profile.assignedDepartments,
        allowedCategories: profile.allowedCategories,
        doubtSubjects: sanitizedDoubtSubjects,
      },
    });

    res.json({
      message: "Settings updated successfully",
      settings: {
        departments: profile.assignedDepartments,
        allowedCategories: profile.allowedCategories,
        doubtSubjects: sanitizedDoubtSubjects,
      },
    });
  } catch (error) {
    console.error("Update super admin settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-61: read the audit trail.
 *
 * SUPER_ADMIN only, deliberately. Most entries in this table are about admin
 * behaviour, and a trail the audited party can read is one they can learn to
 * work around.
 */
export const getAuditLog = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const asString = (value: unknown): string | undefined =>
      typeof value === "string" && value.trim() ? value.trim() : undefined;

    const asDate = (value: unknown): Date | undefined => {
      const raw = asString(value);
      if (!raw) return undefined;
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const result = await queryAuditLog({
      action: asString(req.query.action),
      actorId: asString(req.query.actorId),
      targetType: asString(req.query.targetType),
      targetId: asString(req.query.targetId),
      from: asDate(req.query.from),
      to: asDate(req.query.to),
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 50,
    });

    res.json(result);
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
