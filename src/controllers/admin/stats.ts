/**
 * Dashboards and analytics for admins and super admins.
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
import type { AuthRequest } from "../../types/index.js";

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
