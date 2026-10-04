/**
 * Admin profiles.
 *
 * Split out of adminController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  AdminLevel,
  ApprovalStatus,
  Role
} from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import type { AuthRequest } from "../../types/index.js";

// Get Admin Profile
export const getAdminProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.adminProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userID: true,
            role: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Admin profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Admin Profile (name)
export const updateAdminProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name } = req.body as { name?: string };

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: String(name).trim() },
      select: { id: true, name: true, email: true, userID: true, role: true },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 13. Create Admin Profile
export const createAdminProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      userId,
      adminLevel,
      manageUsers,
      manageComplaints,
      viewAnalytics,
      assignedDepartments,
      allowedCategories,
    } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
      res.status(400).json({ error: "User is not an admin or super admin" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.adminProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Admin profile already exists" });
      return;
    }

    const profile = await prisma.adminProfile.create({
      data: {
        userId,
        adminLevel: adminLevel || AdminLevel.NORMAL,
        manageUsers: manageUsers !== undefined ? manageUsers : true,
        manageComplaints:
          manageComplaints !== undefined ? manageComplaints : true,
        viewAnalytics: viewAnalytics !== undefined ? viewAnalytics : true,
        assignedDepartments: assignedDepartments || [],
        allowedCategories: allowedCategories || [],
        complaintsAssigned: 0,
        complaintsClosed: 0,
        usersManaged: req.body.usersManaged || 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Admin profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create admin profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
