import { ApprovalStatus, ComplaintStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/database.js";
import {
  appendComplaintAssignmentHistory,
  buildComplaintAssignmentHistoryEntry,
} from "./complaintAssignmentHistory.js";
import { notifyComplaintAssignment } from "./notifications.js";

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

// Type for user with included relations
type FacultyWithProfile = {
  id: string;
  name: string;
  facultyProfile: {
    department: string;
    subjects: string[];
  } | null;
  assignedComplaints: Array<{ id: string }>;
};

// Auto-routing rules: map complaint categories to departments/subjects
const ROUTING_RULES: Record<
  string,
  {
    departments: string[];
    subjects?: string[];
    priority?: number;
  }
> = {
  PROJECTOR: {
    departments: ["Information Technology", "Computer Engineering"],
    subjects: ["Networks", "DBMS"],
    priority: 2,
  },
  SMART_BOARD: {
    departments: [
      "Information Technology",
      "Computer Engineering",
      "Electronics",
    ],
    subjects: ["DSA", "DBMS", "Networks"],
    priority: 2,
  },
  FAN: {
    departments: ["Electrical Engineering", "Mechanical Engineering"],
    priority: 1,
  },
  LIGHT: {
    departments: ["Electrical Engineering"],
    priority: 1,
  },
  SEATING: {
    departments: ["Civil Engineering", "Mechanical Engineering"],
    priority: 3,
  },
};

export interface AutoRoutingResult {
  success: boolean;
  assignedTo?: {
    id: string;
    name: string;
    department: string;
  };
  reason?: string;
}

export async function autoAssignComplaint(
  complaintId: string,
  category: string,
  block?: string,
): Promise<AutoRoutingResult> {
  try {
    const rules = ROUTING_RULES[category];
    if (!rules) {
      return {
        success: false,
        reason: `No routing rules defined for category: ${category}`,
      };
    }

    // Find available faculty members based on rules
    const facultyQuery = {
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: true,
        facultyProfile: {
          isTeaching: true,
          OR: [
            // Match by department
            {
              department: {
                in: rules.departments,
              },
            },
            // Match by subjects (if specified)
            ...(rules.subjects
              ? [
                  {
                    subjects: {
                      hasSome: rules.subjects,
                    },
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        facultyProfile: true,
        assignedComplaints: {
          where: {
            status: {
              in: [
                ComplaintStatus.RAISED,
                ComplaintStatus.ASSIGNED,
                ComplaintStatus.IN_PROGRESS,
              ],
            },
          },
        },
      },
    };

    const availableFaculty = (await prisma.user.findMany(
      facultyQuery,
    )) as FacultyWithProfile[];

    if (availableFaculty.length === 0) {
      return {
        success: false,
        reason: `No available faculty found for category: ${category}`,
      };
    }

    // Sort faculty by workload (fewer active complaints first)
    const sortedFaculty = availableFaculty.sort((a, b) => {
      const workloadA = a.assignedComplaints.length;
      const workloadB = b.assignedComplaints.length;

      // Primary sort: by workload
      if (workloadA !== workloadB) {
        return workloadA - workloadB;
      }

      // Secondary sort: prefer faculty from matching department
      const deptMatchA = rules.departments.includes(
        a.facultyProfile?.department || "",
      );
      const deptMatchB = rules.departments.includes(
        b.facultyProfile?.department || "",
      );

      if (deptMatchA && !deptMatchB) return -1;
      if (!deptMatchA && deptMatchB) return 1;

      // Tertiary sort: prefer faculty with matching subjects
      if (rules.subjects) {
        const subjMatchA = rules.subjects.some((subj) =>
          a.facultyProfile?.subjects.includes(subj),
        );
        const subjMatchB = rules.subjects.some((subj) =>
          b.facultyProfile?.subjects.includes(subj),
        );

        if (subjMatchA && !subjMatchB) return -1;
        if (!subjMatchA && subjMatchB) return 1;
      }

      return 0;
    });

    const selectedFaculty = sortedFaculty[0];

    if (!selectedFaculty) {
      return {
        success: false,
        reason: `No suitable faculty found for category: ${category}`,
      };
    }

    let complaint: {
      title: string;
      assignedTo: { id: string; name: string } | null;
      assignmentHistory?: unknown;
    } | null = null;

    try {
      complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: {
          title: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
          assignmentHistory: true,
        },
      });
    } catch (readError) {
      if (!isAssignmentHistoryColumnError(readError)) {
        throw readError;
      }

      complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: {
          title: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    if (!complaint) {
      return {
        success: false,
        reason: "Complaint not found",
      };
    }

    const assignmentHistory = appendComplaintAssignmentHistory(
      complaint.assignmentHistory ?? [],
      buildComplaintAssignmentHistoryEntry({
        fromAssigneeId: complaint.assignedTo?.id ?? null,
        fromAssigneeName: complaint.assignedTo?.name ?? null,
        toAssigneeId: selectedFaculty.id,
        toAssigneeName: selectedFaculty.name,
        performedById: null,
        performedByRole: "SYSTEM",
        mode: "AUTO",
      }),
    );

    // Assign the complaint
    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: {
          assignedTo: {
            connect: { id: selectedFaculty.id },
          },
          status: "ASSIGNED",
          assignedAt: new Date(),
          assignmentHistory,
        },
      });
    } catch (updateError) {
      if (!isAssignmentHistoryColumnError(updateError)) {
        throw updateError;
      }

      await prisma.complaint.update({
        where: { id: complaintId },
        data: {
          assignedTo: {
            connect: { id: selectedFaculty.id },
          },
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      });
    }

    await notifyComplaintAssignment(
      selectedFaculty.id,
      complaint.title,
      complaintId,
    );

    return {
      success: true,
      assignedTo: {
        id: selectedFaculty.id,
        name: selectedFaculty.name,
        department: selectedFaculty.facultyProfile?.department || "Unknown",
      },
    };
  } catch (error) {
    console.error("Auto-assignment error:", error);
    return {
      success: false,
      reason: `Auto-assignment failed: ${error}`,
    };
  }
}

export async function getRoutingStats(): Promise<{
  totalAutoAssigned: number;
  assignmentsByCategory: Record<string, number>;
  facultyWorkload: Array<{
    facultyId: string;
    name: string;
    department: string;
    activeComplaints: number;
  }>;
}> {
  try {
    // Get all assigned complaints (could be auto or manual)
    const complaints = await prisma.complaint.findMany({
      where: {
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "RESOLVED"],
        },
      },
      include: {
        assignedTo: {
          include: {
            facultyProfile: true,
          },
        },
      },
    });

    const assignmentsByCategory = complaints.reduce(
      (acc, complaint) => {
        acc[complaint.category] = (acc[complaint.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get faculty workload
    const faculty = await prisma.user.findMany({
      where: {
        role: Role.FACULTY,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      include: {
        facultyProfile: true,
        assignedComplaints: {
          where: {
            status: {
              in: ["ASSIGNED", "IN_PROGRESS"],
            },
          },
        },
      },
    });

    const facultyWorkload = faculty.map((f) => ({
      facultyId: f.id,
      name: f.name,
      department: f.facultyProfile?.department || "Unknown",
      activeComplaints: f.assignedComplaints.length,
    }));

    return {
      totalAutoAssigned: complaints.length,
      assignmentsByCategory,
      facultyWorkload,
    };
  } catch (error) {
    console.error("Error getting routing stats:", error);
    return {
      totalAutoAssigned: 0,
      assignmentsByCategory: {} as Record<string, number>,
      facultyWorkload: [],
    };
  }
}
