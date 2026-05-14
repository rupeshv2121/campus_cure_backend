import { AdminLevel, ApprovalStatus, Prisma, Role } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";
import {
  appendComplaintAssignmentHistory,
  buildComplaintAssignmentHistoryEntry,
} from "../utils/complaintAssignmentHistory.js";
import {
  createNotification,
  notifyComplaintAssignment,
  notifyComplaintStatusChange,
} from "../utils/notifications.js";

const DEFAULT_DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical",
];

const DEFAULT_ALLOWED_CATEGORIES = [
  "PROJECTOR",
  "FAN",
  "LIGHT",
  "SMART_BOARD",
  "SEATING",
  "FURNITURE",
  "NETWORK",
  "OTHER",
];

const DEFAULT_DOUBT_SUBJECTS = ["DSA", "DBMS", "OS", "NETWORKS"];

const isAssignmentHistoryColumnError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== "P2022") {
      return false;
    }

    const column =
      typeof error.meta === "object" && error.meta && "column" in error.meta
        ? String((error.meta as { column?: string }).column || "")
        : "";

    return column.includes("assignmentHistory");
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return error.message.includes("assignmentHistory");
  }

  return false;
};

const sanitizeStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  );
};

const getDoubtSubjectsByUserId = async (userId: string): Promise<string[]> => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ doubtSubjects: string[] | null }>
    >`
      SELECT "doubtSubjects"
      FROM "AdminProfile"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    const subjects = rows[0]?.doubtSubjects;
    return Array.isArray(subjects) && subjects.length > 0
      ? subjects
      : DEFAULT_DOUBT_SUBJECTS;
  } catch {
    // If column/client is temporarily out of sync, fall back safely.
    return DEFAULT_DOUBT_SUBJECTS;
  }
};

const setDoubtSubjectsByUserId = async (
  userId: string,
  subjects: string[],
): Promise<void> => {
  try {
    await prisma.$executeRaw`
      UPDATE "AdminProfile"
      SET "doubtSubjects" = ${subjects}, "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `;
  } catch {
    // No-op to avoid hard-failing settings when deployment/client is out of sync.
  }
};

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
        university: req.user!.university,
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
        university: req.user!.university,
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
      (c) => c.status === "RESOLVED",
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
      if (complaint.status === "RESOLVED") {
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
      if (complaint.status === "RESOLVED") {
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
      if (complaint.status === "RESOLVED") {
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
    const userRole = req.user!.role;

    // Build filter based on role
    let whereClause: any = {};

    // Regular admins should not see complaints escalated to superadmin
    if (userRole === Role.ADMIN) {
      whereClause = {
        AND: [
          {
            escalationCount: {
              lte: 0,
            },
          },
          {
            handledBySuperAdmin: false,
          },
        ],
      };
    }
    // SuperAdmins can see all complaints (no filter needed)

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        classroomNumber: true,
        block: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedAt: true,
        handledBySuperAdmin: true,
        superAdminId: true,
        assignmentHistory: true,
        escalationCount: true,
        resolutionNote: true,
        studentRejectionMessage: true,
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
      select: {
        id: true,
        title: true,
        status: true,
        raisedById: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
    const assignmentEntry = buildComplaintAssignmentHistoryEntry({
      fromAssigneeId: complaint.assignedTo?.id ?? null,
      fromAssigneeName: complaint.assignedTo?.name ?? null,
      toAssigneeId: facultyId,
      toAssigneeName: faculty.name,
      performedById: req.user!.id,
      performedByRole: req.user!.role,
      mode: "ADMIN",
    });

    let currentAssignmentHistory: unknown = [];
    try {
      const historyRow = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: { assignmentHistory: true },
      });
      currentAssignmentHistory = historyRow?.assignmentHistory ?? [];
    } catch (historyError) {
      if (!isAssignmentHistoryColumnError(historyError)) {
        throw historyError;
      }
    }

    const baseComplaintUpdateData = {
      assignedTo: {
        connect: { id: facultyId },
      },
      status: "ASSIGNED" as const,
      assignedAt: new Date(),
    };

    const complaintUpdateDataWithHistory = {
      ...baseComplaintUpdateData,
      assignmentHistory: appendComplaintAssignmentHistory(
        currentAssignmentHistory,
        assignmentEntry,
      ),
    };

    try {
      await prisma.$transaction([
        prisma.complaint.update({
          where: { id: complaintId },
          data: complaintUpdateDataWithHistory,
        }),
        prisma.adminProfile.update({
          where: { userId: req.user!.id },
          data: {
            complaintsAssigned: { increment: 1 },
          },
        }),
      ]);
    } catch (updateError) {
      if (!isAssignmentHistoryColumnError(updateError)) {
        throw updateError;
      }

      await prisma.$transaction([
        prisma.complaint.update({
          where: { id: complaintId },
          data: baseComplaintUpdateData,
        }),
        prisma.adminProfile.update({
          where: { userId: req.user!.id },
          data: {
            complaintsAssigned: { increment: 1 },
          },
        }),
      ]);
    }

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
    const whereClause =
      req.user!.role === Role.ADMIN
        ? {
            university: req.user!.university,
            role: { not: Role.SUPER_ADMIN },
          }
        : {
            university: req.user!.university,
          };

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

    // Validate status - include all new statuses
    const validStatuses = [
      "RAISED",
      "ASSIGNED",
      "IN_PROGRESS",
      "PENDING_CONFIRMATION",
      "RESOLVED",
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

    if (complaint.status === "RESOLVED" && status !== "RESOLVED") {
      res.status(400).json({
        error: "Resolved complaints cannot be updated",
      });
      return;
    }

    // Update complaint status
    const updateData: any = {
      status,
    };

    // Add resolution note if status is PENDING_CONFIRMATION or RESOLVED
    if (
      (status === "PENDING_CONFIRMATION" || status === "RESOLVED") &&
      resolutionNote
    ) {
      updateData.resolutionNote = resolutionNote;
    }

    // Set confirmation timing when marking as PENDING_CONFIRMATION.
    if (status === "PENDING_CONFIRMATION") {
      updateData.resolutionDate = new Date();
      updateData.pendingConfirmationAt = new Date();
    } else {
      // Clear stale pending timestamp when moving to other statuses.
      updateData.pendingConfirmationAt = null;
    }

    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });
    } catch (updateError) {
      // Backward compatibility: retry without pendingConfirmationAt if migration is pending.
      if (
        updateError instanceof Prisma.PrismaClientKnownRequestError &&
        updateError.code === "P2022"
      ) {
        const { pendingConfirmationAt: _ignored, ...fallbackData } = updateData;
        await prisma.complaint.update({
          where: { id: complaintId },
          data: fallbackData,
        });
      } else {
        throw updateError;
      }
    }

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

    // Update admin stats when complaint is resolved
    if (
      status === "RESOLVED" &&
      complaint.status !== "RESOLVED" &&
      complaint.status !== "PENDING_CONFIRMATION"
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
      prisma.complaint.count({ where: { status: { in: ["RESOLVED"] } } }),
      prisma.doubt.count(),
      prisma.adminProfile.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              userID: true,
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

// ============ SUPER ADMIN COMPLAINT FUNCTIONS ============

// Get Escalated Complaints (Super Admin Only)
export const getEscalatedComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const escalatedComplaints = await prisma.complaint.findMany({
      where: {
        escalationCount: {
          gt: 0,
        },
        status: {
          not: "RESOLVED",
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        classroomNumber: true,
        block: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        escalationCount: true,
        resolutionNote: true,
        studentRejectionMessage: true,
        assignedAt: true,
        handledBySuperAdmin: true,
        superAdminId: true,
        assignmentHistory: true,
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
      orderBy: [
        { escalationCount: "desc" }, // Most escalated first
        { createdAt: "desc" },
      ],
    });

    res.json({ complaints: escalatedComplaints });
  } catch (error) {
    console.error("Get escalated complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Reassign Escalated Complaint (Super Admin Only)
export const reassignEscalatedComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, facultyId, superAdminNote } = req.body;

    if (!complaintId || !facultyId) {
      res
        .status(400)
        .json({ error: "Complaint ID and Faculty ID are required" });
      return;
    }

    // Verify complaint exists and is escalated
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        title: true,
        status: true,
        escalationCount: true,
        assignedToId: true,
        resolutionNote: true,
        raisedById: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if ((complaint.escalationCount ?? 0) <= 0) {
      res
        .status(400)
        .json({ error: "Only escalated complaints can be reassigned" });
      return;
    }

    if (complaint.status !== "RAISED" && complaint.status !== "ASSIGNED") {
      res.status(400).json({
        error: "Only RAISED or ASSIGNED escalated complaints can be reassigned",
      });
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

    const previousAssigneeId =
      complaint.assignedTo?.id ?? complaint.assignedToId ?? null;

    if (previousAssigneeId === facultyId) {
      res
        .status(400)
        .json({ error: "Complaint is already assigned to this faculty" });
      return;
    }

    // Keep existing complaint status; only transfer assignee and add super-admin metadata.
    const assignmentEntry = buildComplaintAssignmentHistoryEntry({
      fromAssigneeId: previousAssigneeId,
      fromAssigneeName: complaint.assignedTo?.name ?? null,
      toAssigneeId: facultyId,
      toAssigneeName: faculty.name,
      performedById: req.user!.id,
      performedByRole: req.user!.role,
      mode: "SUPER_ADMIN",
      note: superAdminNote || null,
    });

    let currentAssignmentHistory: unknown = [];
    try {
      const historyRow = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: { assignmentHistory: true },
      });
      currentAssignmentHistory = historyRow?.assignmentHistory ?? [];
    } catch (historyError) {
      if (!isAssignmentHistoryColumnError(historyError)) {
        throw historyError;
      }
    }

    const updateData: any = {
      assignedTo: {
        connect: { id: facultyId },
      },
      assignedAt: new Date(),
      handledBySuperAdmin: true,
      superAdminId: req.user!.id,
      assignmentHistory: appendComplaintAssignmentHistory(
        currentAssignmentHistory,
        assignmentEntry,
      ),
    };

    // Add superadmin note to resolution notes
    if (superAdminNote) {
      updateData.resolutionNote = `${complaint.resolutionNote || ""}\n\n[${new Date().toLocaleString()}] SuperAdmin Note: ${superAdminNote}`;
    }

    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });
    } catch (updateError) {
      if (!isAssignmentHistoryColumnError(updateError)) {
        throw updateError;
      }

      const { assignmentHistory: _ignored, ...fallbackUpdateData } = updateData;
      await prisma.complaint.update({
        where: { id: complaintId },
        data: fallbackUpdateData,
      });
    }

    // Send notifications
    try {
      // Notify the student
      await createNotification({
        userId: complaint.raisedById,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Reassigned by Super Admin",
        message: `Your complaint "${complaint.title}" has been reassigned to ${faculty.name} by Super Admin for resolution.`,
        data: { complaintId, newFacultyId: facultyId },
      });

      // Notify the new faculty member
      await notifyComplaintAssignment(facultyId, complaint.title, complaintId);

      // If there was a previous faculty, notify them too
      if (previousAssigneeId && previousAssigneeId !== facultyId) {
        await createNotification({
          userId: previousAssigneeId,
          type: "COMPLAINT_STATUS_UPDATE",
          title: "Complaint Reassigned",
          message: `Complaint "${complaint.title}" has been reassigned to another faculty member by Super Admin.`,
          data: { complaintId },
        });
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      message: "Complaint reassigned successfully by Super Admin",
      assignedTo: faculty.name,
    });
  } catch (error) {
    console.error("Reassign escalated complaint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark Escalated Complaint as Handled (Super Admin takes over)
export const markComplaintAsHandled = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, action } = req.body;

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true, assignedTo: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        handledBySuperAdmin: true,
        superAdminId: req.user!.id,
      },
    });

    // Notify student
    try {
      await createNotification({
        userId: complaint.raisedById,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Escalated to Super Admin",
        message: `Your complaint "${complaint.title}" is now being handled by Super Admin.`,
        data: { complaintId },
      });
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
    }

    res.json({ message: "Complaint marked as handled by Super Admin" });
  } catch (error) {
    console.error("Mark complaint as handled error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
