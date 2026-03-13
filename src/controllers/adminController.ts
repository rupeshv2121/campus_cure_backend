import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { AdminLevel, ApprovalStatus, Role } from "@prisma/client";
import type { AuthRequest } from "../types/index.js";
import { autoAssignComplaint, getRoutingStats } from "../utils/autoRouting.js";
import {
  notifyComplaintAssignment,
  notifyComplaintStatusChange,
} from "../utils/notifications.js";

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
            username: true,
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
      select: { id: true, name: true, email: true, username: true, role: true },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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

    res.json({ message: "User rejected successfully", user: updatedUser });
  } catch (error) {
    console.error("Reject user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 17. Get Dashboard Stats
export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Get all complaints with basic info
    const complaints = await prisma.complaint.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        category: true,
        raisedBy: {
          select: {
            studentProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
    });

    // Get all doubts count
    const doubtsCount = await prisma.doubt.count();

    // Calculate stats
    const totalComplaints = complaints.length;
    const resolvedComplaints = complaints.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED",
    ).length;
    const raisedComplaints = complaints.filter(
      (c) => c.status === "RAISED",
    ).length;

    // Get complaints by month (last 6 months)
    const complaintsByMonthMap = new Map<
      string,
      { complaints: number; resolved: number }
    >();
    const complaintsByTypeMap = new Map<string, number>();
    const complaintsByDeptMap = new Map<string, number>();

    complaints.forEach((complaint) => {
      const month = new Date(complaint.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });

      // Complaints by month
      const monthData = complaintsByMonthMap.get(month) || {
        complaints: 0,
        resolved: 0,
      };
      monthData.complaints += 1;
      if (complaint.status === "RESOLVED" || complaint.status === "CLOSED") {
        monthData.resolved += 1;
      }
      complaintsByMonthMap.set(month, monthData);

      // Complaints by type/category
      complaintsByTypeMap.set(
        complaint.category,
        (complaintsByTypeMap.get(complaint.category) || 0) + 1,
      );

      // Complaints by department
      const dept = complaint.raisedBy?.studentProfile?.department || "Unknown";
      complaintsByDeptMap.set(dept, (complaintsByDeptMap.get(dept) || 0) + 1);
    });

    // Convert to arrays
    const complaintsByMonth = Array.from(complaintsByMonthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-6); // Last 6 months

    const complaintsByType = Array.from(complaintsByTypeMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      }),
    );

    const complaintsByDept = Array.from(complaintsByDeptMap.entries())
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 departments

    res.json({
      stats: {
        totalComplaints,
        resolvedComplaints,
        raisedComplaints,
        totalDoubts: doubtsCount,
      },
      analytics: {
        complaintsByMonth,
        complaintsByType,
        complaintsByDept,
      },
      complaints: complaints.map((c) => ({
        id: c.id,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 18. Get Analytics Data
export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Get total complaints grouped by month
    const complaints = await prisma.complaint.findMany({
      select: {
        createdAt: true,
        updatedAt: true,
        status: true,
        category: true,
        raisedBy: {
          select: {
            studentProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
    });

    // Process complaints by month
    const complaintsByMonthMap = new Map<
      string,
      { complaints: number; resolved: number }
    >();
    const complaintsByTypeMap = new Map<string, number>();
    const complaintsByDeptMap = new Map<string, number>();
    const resolutionTimes: {
      month: string;
      totalDays: number;
      count: number;
    }[] = [];
    const resolutionTimeByMonth = new Map<
      string,
      { totalDays: number; count: number }
    >();

    complaints.forEach((complaint) => {
      const month = new Date(complaint.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });

      // Complaints by month
      const monthData = complaintsByMonthMap.get(month) || {
        complaints: 0,
        resolved: 0,
      };
      monthData.complaints += 1;
      if (complaint.status === "RESOLVED" || complaint.status === "CLOSED") {
        monthData.resolved += 1;
      }
      complaintsByMonthMap.set(month, monthData);

      // Complaints by type
      complaintsByTypeMap.set(
        complaint.category,
        (complaintsByTypeMap.get(complaint.category) || 0) + 1,
      );

      // Complaints by department
      const dept = complaint.raisedBy?.studentProfile?.department || "Unknown";
      complaintsByDeptMap.set(dept, (complaintsByDeptMap.get(dept) || 0) + 1);

      // Resolution time
      if (complaint.status === "RESOLVED" || complaint.status === "CLOSED") {
        const createdAt = new Date(complaint.createdAt);
        const resolvedAt = new Date(complaint.updatedAt);
        const daysToResolve = Math.ceil(
          (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        const monthResolution = resolutionTimeByMonth.get(month) || {
          totalDays: 0,
          count: 0,
        };
        monthResolution.totalDays += daysToResolve;
        monthResolution.count += 1;
        resolutionTimeByMonth.set(month, monthResolution);
      }
    });

    // Convert to arrays
    const complaintsByMonth = Array.from(complaintsByMonthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-6); // Last 6 months

    const complaintsByType = Array.from(complaintsByTypeMap.entries()).map(
      ([name, value]) => ({
        name,
        value,
      }),
    );

    const complaintsByDept = Array.from(complaintsByDeptMap.entries())
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 departments

    const resolutionTime = Array.from(resolutionTimeByMonth.entries())
      .map(([month, data]) => ({
        month,
        avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-6); // Last 6 months

    res.json({
      complaintsByMonth,
      complaintsByType,
      complaintsByDept,
      resolutionTime,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 19. Get All Complaints (Admin)
export const getAllComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: {
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: {
              select: {
                enrollmentNumber: true,
                department: true,
                branch: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            facultyProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ complaints });
  } catch (error) {
    console.error("Get all complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 20. Get Approved Faculty (Admin)
export const getApprovedFaculty = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // First, let's see all faculty in the system for debugging
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
        facultyProfile: {
          select: {
            department: true,
            branch: true,
          },
        },
      },
    });

    console.log("All faculty in system:", allFaculty.length);
    console.log(
      "Faculty details:",
      allFaculty.map((f) => ({
        name: f.name,
        approvalStatus: f.approvalStatus,
        isActive: f.isActive,
      })),
    );

    const faculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
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

    console.log("Approved and active faculty:", faculty.length);
    console.log("Approved faculty details:", faculty);

    res.json({ faculty });
  } catch (error) {
    console.error("Get approved faculty error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 21. Assign Complaint to Faculty (Admin)
export const assignComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, facultyId } = req.body;

    if (!complaintId || !facultyId) {
      res
        .status(400)
        .json({ error: "Complaint ID and Faculty ID are required" });
      return;
    }

    // Verify complaint exists
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true }, // Include who raised the complaint for notifications
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    // Verify faculty exists and is approved
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      include: { facultyProfile: true },
    });

    if (
      !faculty ||
      faculty.role !== Role.FACULTY ||
      faculty.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      res.status(400).json({ error: "Invalid faculty member" });
      return;
    }

    // Update complaint and admin stats
    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: complaintId },
        data: {
          assignedToId: facultyId,
          status: "ASSIGNED",
        },
      }),
      prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          complaintsAssigned: { increment: 1 },
        },
      }),
    ]);

    // Send notifications
    try {
      // Notify the student who raised the complaint
      await notifyComplaintStatusChange(
        complaint.raisedById,
        complaint.title,
        complaint.status,
        "ASSIGNED",
        complaintId,
      );

      // Notify the faculty member who got assigned
      await notifyComplaintAssignment(facultyId, complaint.title, complaintId);
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({ message: "Complaint assigned successfully" });
  } catch (error) {
    console.error("Assign complaint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 22. Get User Details (Admin)
export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
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
    console.log("All users fetched:", users.length);
    res.json({ users });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 23. Update Complaint Status (Admin)
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, status, resolutionNote } = req.body;

    if (!complaintId || !status) {
      res.status(400).json({ error: "Complaint ID and status are required" });
      return;
    }

    // Validate status
    const validStatuses = [
      "RAISED",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    // Verify complaint exists
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true }, // Include who raised the complaint for notifications
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    // Update complaint status
    const updateData: any = {
      status,
    };

    // Add resolution note if status is RESOLVED or CLOSED
    if ((status === "RESOLVED" || status === "CLOSED") && resolutionNote) {
      updateData.resolutionNote = resolutionNote;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // Send notification for status change
    try {
      if (complaint.status !== status) {
        await notifyComplaintStatusChange(
          complaint.raisedById,
          complaint.title,
          complaint.status,
          status,
          complaintId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    // Update admin stats if complaint is being closed
    if (
      (status === "RESOLVED" || status === "CLOSED") &&
      complaint.status !== "RESOLVED" &&
      complaint.status !== "CLOSED"
    ) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          complaintsClosed: { increment: 1 },
        },
      });
    }

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    console.error("Update complaint status error:", error);
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

    // Authorization check: Admin can update Student/Faculty, Super Admin can update Anyone
    if (req.user!.role === Role.ADMIN && userToUpdate.role === Role.ADMIN) {
      res
        .status(403)
        .json({ error: "Only Super Admin can modify Admin users" });
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

    // Authorization check: Admin can update Student/Faculty, Super Admin can update Anyone
    if (req.user!.role === Role.ADMIN && userToUpdate.role === Role.ADMIN) {
      res
        .status(403)
        .json({ error: "Only Super Admin can modify Admin users" });
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

    res.json({
      message: "User approval status updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user approval status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Super Admin: System-wide stats
export const getSuperAdminStats = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const [
      totalStudents,
      totalFaculty,
      totalAdmins,
      pendingStudents,
      pendingFaculty,
      pendingAdmins,
      totalComplaints,
      resolvedComplaints,
      totalDoubts,
      adminProfiles,
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.FACULTY } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({
        where: { role: Role.STUDENT, approvalStatus: ApprovalStatus.PENDING },
      }),
      prisma.user.count({
        where: { role: Role.FACULTY, approvalStatus: ApprovalStatus.PENDING },
      }),
      prisma.user.count({
        where: { role: Role.ADMIN, approvalStatus: ApprovalStatus.PENDING },
      }),
      prisma.complaint.count(),
      prisma.complaint.count({
        where: { status: { in: ["RESOLVED", "CLOSED"] } },
      }),
      prisma.doubt.count(),
      prisma.adminProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              approvalStatus: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      stats: {
        totalStudents,
        totalFaculty,
        totalAdmins,
        pendingStudents,
        pendingFaculty,
        pendingAdmins,
        totalComplaints,
        resolvedComplaints,
        totalDoubts,
        resolutionRate:
          totalComplaints > 0
            ? Math.round((resolvedComplaints / totalComplaints) * 100)
            : 0,
      },
      adminProfiles,
    });
  } catch (error) {
    console.error("Get super admin stats error:", error);
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

// Get Auto-Routing Statistics
export const getRoutingStatistics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const stats = await getRoutingStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Get routing statistics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Force Auto-Assignment for a Complaint
export const forceAutoAssignment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    // Get complaint details
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.assignedToId) {
      res.status(400).json({ error: "Complaint is already assigned" });
      return;
    }

    // Attempt auto-assignment
    const result = await autoAssignComplaint(
      complaintId,
      complaint.category,
      complaint.block,
    );

    if (result.success) {
      // Send notification to student about assignment
      await notifyComplaintStatusChange(
        complaint.raisedById,
        complaint.title,
        complaint.status,
        "ASSIGNED",
        complaintId,
      );

      res.json({
        message: "Complaint auto-assigned successfully",
        assignedTo: result.assignedTo,
      });
    } else {
      res.status(400).json({
        error: "Auto-assignment failed",
        reason: result.reason,
      });
    }
  } catch (error) {
    console.error("Force auto-assignment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
