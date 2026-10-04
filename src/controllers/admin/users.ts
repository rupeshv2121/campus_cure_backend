/**
 * User administration: approval queues, approve/reject, activation, admin permissions, the faculty list.
 *
 * Split out of adminController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  Role
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  AuditAction,
  auditFromRequest
} from "../../services/audit/auditLog.js";
import type { AuthRequest } from "../../types/index.js";

// 11. Get Pending Students (Admin)
export const getPendingStudents = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const pendingStudents = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        studentProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingStudents });
  } catch (error) {
    console.error("Get pending students error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 12. Get Pending Faculty (Admin)
export const getPendingFaculty = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const pendingFaculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        facultyProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingFaculty });
  } catch (error) {
    console.error("Get pending faculty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 14. Get Pending Admins (Super Admin)
export const getPendingAdmins = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const pendingAdmins = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        approvalStatus: ApprovalStatus.PENDING,
      },
      include: {
        adminProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ pendingAdmins });
  } catch (error) {
    console.error("Get pending admins error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 15. Approve User
export const approveUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const userToApprove = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToApprove) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can approve Student/Faculty, Super Admin can approve Admin
    if (req.user!.role === Role.ADMIN && userToApprove.role === Role.ADMIN) {
      res
        .status(403)
        .json({ error: "Only Super Admin can approve Admin users" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.USER_APPROVE,
      targetType: "User",
      targetId: userId,
      summary: `Approved ${updatedUser.role} account ${updatedUser.userID}`,
      metadata: { role: updatedUser.role, email: updatedUser.email },
    });

    res.json({ message: "User approved successfully", user: updatedUser });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16. Reject User
export const rejectUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const userToReject = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToReject) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can reject Student/Faculty, Super Admin can reject Admin
    if (req.user!.role === Role.ADMIN && userToReject.role === Role.ADMIN) {
      res
        .status(403)
        .json({ error: "Only Super Admin can reject Admin users" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.REJECTED },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.USER_REJECT,
      targetType: "User",
      targetId: updatedUser.id,
      summary: `Rejected ${updatedUser.role} account ${updatedUser.userID}`,
      metadata: { role: updatedUser.role, email: updatedUser.email },
    });

    res.json({ message: "User rejected successfully", user: updatedUser });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 20. Get Approved Faculty (Admin)
export const getApprovedFaculty = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Return only approved faculty for assignment/reassignment flows.
    const faculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        isActive: true,
        facultyProfile: {
          select: {
            department: true,
            branch: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json({ faculty });
  } catch (error) {
    console.error("Get approved faculty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 22. Get User Details (Admin)
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const whereClause =
      req.user!.role === Role.ADMIN
        ? { role: { not: Role.SUPER_ADMIN } }
        : {};

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        userID: true,
        role: true,
        approvalStatus: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json({ users });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 24. Toggle User Active Status
export const toggleUserActiveStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
      return;
    }

    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can update only student/faculty users.
    if (
      req.user!.role === Role.ADMIN &&
      (userToUpdate.role === Role.ADMIN ||
        userToUpdate.role === Role.SUPER_ADMIN)
    ) {
      res.status(403).json({
        error: "Only Super Admin can modify Admin or Super Admin users",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.USER_ACTIVE_TOGGLE,
      targetType: "User",
      targetId: userId,
      summary: `${isActive ? "Activated" : "Deactivated"} ${updatedUser.role} ${updatedUser.userID}`,
      metadata: { isActive, role: updatedUser.role },
    });

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Toggle user active status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 25. Update User Approval Status
export const updateUserApprovalStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { approvalStatus } = req.body;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    // Validate approval status
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(approvalStatus)) {
      res.status(400).json({ error: "Invalid approval status" });
      return;
    }

    const userToUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToUpdate) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Authorization check: Admin can update only student/faculty users.
    if (
      req.user!.role === Role.ADMIN &&
      (userToUpdate.role === Role.ADMIN ||
        userToUpdate.role === Role.SUPER_ADMIN)
    ) {
      res.status(403).json({
        error: "Only Super Admin can modify Admin or Super Admin users",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus },
    });

    // Update admin stats
    if (req.user!.role === Role.ADMIN || req.user!.role === Role.SUPER_ADMIN) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          usersManaged: { increment: 1 },
        },
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.USER_APPROVAL_STATUS_CHANGE,
      targetType: "User",
      targetId: userId,
      summary: `Set ${updatedUser.userID} approval to ${approvalStatus}`,
      metadata: {
        from: userToUpdate.approvalStatus,
        to: approvalStatus,
        role: updatedUser.role,
      },
    });

    res.json({
      message: "User approval status updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user approval status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Super Admin: Update another admin's permissions
export const updateAdminPermissions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const adminProfileId = String(req.params.adminProfileId);
    const {
      manageUsers,
      manageComplaints,
      manageDoubts,
      viewAnalytics,
      assignedDepartments,
      allowedCategories,
    } = req.body as {
      manageUsers?: boolean;
      manageComplaints?: boolean;
      manageDoubts?: boolean;
      viewAnalytics?: boolean;
      assignedDepartments?: string[];
      allowedCategories?: string[];
    };

    if (!adminProfileId) {
      res.status(400).json({ error: "Admin profile ID is required" });
      return;
    }

    const profile = await prisma.adminProfile.findUnique({
      where: { id: adminProfileId },
    });

    if (!profile) {
      res.status(404).json({ error: "Admin profile not found" });
      return;
    }

    // Cannot modify your own profile through this endpoint
    if (profile.userId === req.user!.id) {
      res.status(403).json({ error: "Cannot modify your own permissions" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (manageUsers !== undefined) data.manageUsers = Boolean(manageUsers);
    if (manageComplaints !== undefined)
      data.manageComplaints = Boolean(manageComplaints);
    if (manageDoubts !== undefined) data.manageDoubts = Boolean(manageDoubts);
    if (viewAnalytics !== undefined)
      data.viewAnalytics = Boolean(viewAnalytics);
    if (Array.isArray(assignedDepartments))
      data.assignedDepartments = assignedDepartments;
    if (Array.isArray(allowedCategories))
      data.allowedCategories = allowedCategories;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const updated = await prisma.adminProfile.update({
      where: { id: adminProfileId },
      data,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // The highest-value entry in the whole table: this is how an admin
    // becomes a more powerful admin. CC-01c exists because that path was
    // once open to the internet.
    await auditFromRequest(req, {
      action: AuditAction.ADMIN_PERMISSIONS_CHANGE,
      targetType: "AdminProfile",
      targetId: adminProfileId,
      summary: `Changed admin permissions for ${updated.user?.email ?? adminProfileId}`,
      metadata: { changed: data },
    });

    res.json({ profile: updated });
  } catch (error) {
    console.error("Update admin permissions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Debug endpoint to get all faculty for troubleshooting
export const getAllFacultyDebug = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const allFaculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
      },
      select: {
        id: true,
        name: true,
        email: true,
        approvalStatus: true,
        isActive: true,
        createdAt: true,
        facultyProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      total: allFaculty.length,
      faculty: allFaculty,
      breakdown: {
        pending: allFaculty.filter((f) => f.approvalStatus === "PENDING")
          .length,
        approved: allFaculty.filter((f) => f.approvalStatus === "APPROVED")
          .length,
        rejected: allFaculty.filter((f) => f.approvalStatus === "REJECTED")
          .length,
        active: allFaculty.filter((f) => f.isActive).length,
        inactive: allFaculty.filter((f) => !f.isActive).length,
      },
    });
  } catch (error) {
    console.error("Get all faculty debug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
