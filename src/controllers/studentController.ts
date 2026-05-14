import { ApprovalStatus, DoubtStatus, Prisma, Role } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import type { AuthRequest, RejectionHistoryEntry } from "../types/index.js";
import {
  createNotification,
  notifyComplaintStatusChange,
} from "../utils/notifications.js";

const isTenDigitPhoneNumber = (value: unknown): boolean =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

const DEFAULT_ALLOWED_COMPLAINT_CATEGORIES = [
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

const KEYWORD_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

const normalizeForKeywordMatch = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractKeywords = (value: string): string[] => {
  const normalized = normalizeForKeywordMatch(value);
  const tokens = normalized.split(" ").filter((token) => {
    return token.length >= 3 && !KEYWORD_STOP_WORDS.has(token);
  });

  return [...new Set(tokens)].slice(0, 8);
};

type CommonDoubtsWindow = "all" | "30d" | "90d";

interface CommonDoubtCandidate {
  id: string;
  title: string;
  subject: string;
  views: number;
  upVoteCount: number;
  answerCount: number;
  createdAt: Date;
}

interface CommonDoubtTopicBucket {
  key: string;
  label: string;
  count: number;
  engagementScore: number;
  newestAt: number;
  topDoubts: CommonDoubtCandidate[];
}

const isDoubtUpvoteSchemaMissingError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
};

const getLatestSuperAdminDoubtSubjects = async (): Promise<string[]> => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ doubtSubjects: string[] | null }>
    >`
      SELECT "doubtSubjects"
      FROM "AdminProfile" ap
      JOIN "User" u ON u."id" = ap."userId"
      WHERE u."role" = 'SUPER_ADMIN'
      ORDER BY ap."updatedAt" DESC
      LIMIT 1
    `;

    const subjects = rows[0]?.doubtSubjects;
    return Array.isArray(subjects) && subjects.length > 0
      ? subjects
      : DEFAULT_DOUBT_SUBJECTS;
  } catch {
    return DEFAULT_DOUBT_SUBJECTS;
  }
};

const getPostingSettings = async (): Promise<{
  allowedCategories: string[];
  doubtSubjects: string[];
}> => {
  const profile = await prisma.adminProfile.findFirst({
    where: {
      user: {
        role: Role.SUPER_ADMIN,
      },
    },
    select: {
      allowedCategories: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const doubtSubjects = await getLatestSuperAdminDoubtSubjects();

  return {
    allowedCategories:
      profile && profile.allowedCategories.length > 0
        ? profile.allowedCategories
        : DEFAULT_ALLOWED_COMPLAINT_CATEGORIES,
    doubtSubjects,
  };
};

// 7b. Get posting settings for students
export const getStudentPostingSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const settings = await getPostingSettings();
    res.json({ settings });
  } catch (error) {
    console.error("Get student posting settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 5. Create Student Profile (Called after basic registration)
export const createStudentProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      userId,
      enrollmentNumber,
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
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

    if (user.role !== Role.STUDENT) {
      res.status(400).json({ error: "User is not a student" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Student profile already exists" });
      return;
    }

    const profile = await prisma.studentProfile.create({
      data: {
        userId,
        enrollmentNumber: enrollmentNumber || user.userID,
        department: department || "",
        branch: branch || "",
        semester: semester || 1,
        phoneNumber: phoneNumber || 0,
        address: address || "",
        isStudying:
          req.body.isStudying !== undefined ? req.body.isStudying : true,
        guardianName: guardianName || "",
        guardianPhone: guardianPhone || "",
        doubtsAsked: 0,
        doubtsSolved: 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Student profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Get Student Profile
export const getStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userID: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 7. Update Student Profile
export const updateStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
    } = req.body;

    const data: {
      department?: string;
      branch?: string;
      semester?: number;
      phoneNumber?: string;
      address?: string;
      guardianName?: string;
      guardianPhone?: string;
    } = {};

    if (department !== undefined) {
      data.department = String(department).trim();
    }

    if (branch !== undefined) {
      data.branch = String(branch).trim();
    }

    if (semester !== undefined) {
      const parsedSemester = Number(semester);

      if (
        !Number.isInteger(parsedSemester) ||
        parsedSemester < 1 ||
        parsedSemester > 8
      ) {
        res
          .status(400)
          .json({ error: "Semester must be an integer between 1 and 8" });
        return;
      }

      data.semester = parsedSemester;
    }

    if (phoneNumber !== undefined) {
      const normalizedPhoneNumber = String(phoneNumber).trim();
      if (
        normalizedPhoneNumber.length > 0 &&
        !isTenDigitPhoneNumber(normalizedPhoneNumber)
      ) {
        res
          .status(400)
          .json({ error: "Phone number must be exactly 10 digits" });
        return;
      }

      data.phoneNumber = normalizedPhoneNumber;
    }

    if (address !== undefined) {
      data.address = String(address).trim();
    }

    if (guardianName !== undefined) {
      data.guardianName = String(guardianName).trim();
    }

    if (guardianPhone !== undefined) {
      const normalizedGuardianPhone = String(guardianPhone).trim();
      if (
        normalizedGuardianPhone.length > 0 &&
        !isTenDigitPhoneNumber(normalizedGuardianPhone)
      ) {
        res
          .status(400)
          .json({ error: "Guardian phone number must be exactly 10 digits" });
        return;
      }

      data.guardianPhone = normalizedGuardianPhone;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No valid fields provided for update" });
      return;
    }

    const profile = await prisma.studentProfile.update({
      where: { userId: req.user!.id },
      data,
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    console.error("Update student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 8. Raise Complaint
export const raiseComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, category, priority, classroomNumber, block } =
      req.body;

    if (
      !title ||
      !description ||
      !category ||
      !priority ||
      !classroomNumber ||
      !block
    ) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    const { allowedCategories } = await getPostingSettings();
    if (!allowedCategories.includes(String(category))) {
      res.status(400).json({
        error: "Selected complaint category is not allowed",
      });
      return;
    }

    console.log("Raising complaint with data:", {
      title,
      description,
      category,
      priority,
      classroomNumber,
      block,
    });

    // Create complaint and update student profile counters in a transaction
    const [complaint] = await prisma.$transaction([
      prisma.complaint.create({
        data: {
          title,
          description,
          category,
          priority,
          classroomNumber,
          block,
          raisedBy: { connect: { id: req.user!.id } },
        },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          totalComplaints: { increment: 1 },
          totalActiveComplaints: { increment: 1 },
        },
      }),
    ]);

    res.status(201).json({
      message: "Complaint raised successfully - will be manually assigned",
      complaint,
    });
  } catch (error) {
    console.error("Error raising complaint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 9. Get All Complaints for student
export const getComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { raisedById: req.user!.id },
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
        resolutionNote: true,
        studentConfirmed: true,
        studentConfirmationDate: true,
        feedbackRating: true,
        feedbackComment: true,
        studentRejectionMessage: true,
        escalationCount: true,
        assignmentHistory: true,
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
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
      orderBy: { createdAt: "desc" },
    });

    res.json({ complaints });
  } catch (e) {
    console.error("Error fetching complaints:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============ DOUBT MANAGEMENT ============

// 10a. Suggest similar doubts while student types
export const getSimilarDoubtSuggestions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const query =
      typeof req.query.query === "string" ? req.query.query.trim() : "";
    const subject =
      typeof req.query.subject === "string"
        ? req.query.subject.trim()
        : undefined;
    const semesterRaw =
      typeof req.query.semester === "string"
        ? Number(req.query.semester)
        : undefined;
    const limitRaw =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const semester =
      typeof semesterRaw === "number" &&
      Number.isInteger(semesterRaw) &&
      semesterRaw >= 1
        ? semesterRaw
        : undefined;

    const limit =
      typeof limitRaw === "number" && Number.isInteger(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 10)
        : 5;

    if (query.length < 3) {
      res.json({ suggestions: [] });
      return;
    }

    const normalizedQuery = normalizeForKeywordMatch(query);
    const keywords = extractKeywords(query);

    const keywordClauses: Prisma.DoubtWhereInput[] = keywords.flatMap(
      (keyword) => [
        { title: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
      ],
    );

    const queryClauses: Prisma.DoubtWhereInput[] = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];

    const orClauses = [...queryClauses, ...keywordClauses];
    if (orClauses.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    const where: Prisma.DoubtWhereInput = {
      postedBy: { university: req.user!.university },
      ...(subject ? { subject } : {}),
      ...(semester ? { semester } : {}),
      OR: orClauses,
    };

    const candidates = await prisma.doubt.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        semester: true,
        views: true,
        createdAt: true,
        _count: {
          select: {
            answers: true,
          },
        },
      },
      take: 40,
      orderBy: {
        createdAt: "desc",
      },
    });

    const scored = candidates
      .map((candidate) => {
        const title = normalizeForKeywordMatch(candidate.title);
        const description = normalizeForKeywordMatch(candidate.description);

        let score = 0;
        if (title.includes(normalizedQuery)) {
          score += 6;
        }
        if (description.includes(normalizedQuery)) {
          score += 3;
        }

        const matchedKeywords = keywords.filter((keyword) => {
          const inTitle = title.includes(keyword);
          const inDescription = description.includes(keyword);

          if (inTitle) {
            score += 3;
          } else if (inDescription) {
            score += 1;
          }

          return inTitle || inDescription;
        });

        return {
          id: candidate.id,
          title: candidate.title,
          subject: candidate.subject,
          semester: candidate.semester,
          views: candidate.views,
          answerCount: candidate._count.answers,
          createdAt: candidate.createdAt,
          matchedKeywords,
          score,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.answerCount !== a.answerCount) {
          return b.answerCount - a.answerCount;
        }
        if (b.views !== a.views) {
          return b.views - a.views;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit)
      .map(({ createdAt, score, ...candidate }) => ({
        ...candidate,
        createdAt: createdAt.toISOString(),
      }));

    res.json({ suggestions: scored });
  } catch (error) {
    console.error("Error fetching doubt suggestions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 10. Post a new doubt
export const postDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, semester, subject, labels } = req.body;

    if (!title || !description || !semester || !subject) {
      res.status(400).json({
        error: "Title, description, semester, and subject are required",
      });
      return;
    }

    const { doubtSubjects } = await getPostingSettings();
    if (!doubtSubjects.includes(String(subject))) {
      res.status(400).json({
        error: "Selected subject is not allowed",
      });
      return;
    }

    console.log("Posting doubt with data:");

    // Create doubt and update student profile in a transaction
    const [doubt] = await prisma.$transaction([
      prisma.doubt.create({
        data: {
          title,
          description,
          semester,
          subject,
          labels: labels || [],
          postedBy: { connect: { id: req.user!.id } },
        },
        include: {
          postedBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              studentProfile: {
                select: {
                  semester: true,
                  branch: true,
                },
              },
            },
          },
        },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          doubtsAsked: { increment: 1 },
        },
      }),
    ]);

    res.status(201).json({ message: "Doubt posted successfully", doubt });
  } catch (error) {
    console.error("Error posting doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 11. Get all doubts with filters
export const getDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { status, subject, semester, search } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (subject) {
      where.subject = subject;
    }

    if (semester) {
      where.semester = parseInt(semester as string, 10);
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    where.postedBy = { university: req.user!.university };

    const doubts = await prisma.doubt.findMany({
      where,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
        _count: {
          select: {
            answers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let userDoubtUpvotes: Array<{ doubtId: string }> = [];
    try {
      userDoubtUpvotes = await prisma.doubtUpvote.findMany({
        where: {
          userId: req.user!.id,
          doubtId: {
            in: doubts.map((doubt) => doubt.id),
          },
        },
        select: {
          doubtId: true,
        },
      });
    } catch (upvoteReadError) {
      // Backward compatibility: allow doubts listing even if upvote table migration isn't applied yet.
      if (!isDoubtUpvoteSchemaMissingError(upvoteReadError)) {
        throw upvoteReadError;
      }
    }

    const upvotedDoubtIds = new Set(userDoubtUpvotes.map((uv) => uv.doubtId));

    res.json({
      doubts: doubts.map((doubt) => ({
        ...doubt,
        isUpvotedByUser: upvotedDoubtIds.has(doubt.id),
      })),
    });
  } catch (error) {
    console.error("Error fetching doubts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 11b. Get Subjectwise doubts analytics (hybrid ranking)
export const getSubjectWiseDoubtsAnalytics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const rawWindow = String(req.query.window || "all").toLowerCase();
    const window: CommonDoubtsWindow =
      rawWindow === "30d" || rawWindow === "90d" || rawWindow === "all"
        ? rawWindow
        : "all";

    const now = new Date();
    const createdAtGte =
      window === "30d"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : window === "90d"
          ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          : null;

    const where: Prisma.DoubtWhereInput = createdAtGte
      ? {
          createdAt: { gte: createdAtGte },
          postedBy: { university: req.user!.university },
        }
      : {
          postedBy: { university: req.user!.university },
        };

    const doubts = await prisma.doubt.findMany({
      where,
      select: {
        id: true,
        title: true,
        subject: true,
        views: true,
        upVoteCount: true,
        answerCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 3000,
    });

    const buckets = new Map<string, CommonDoubtTopicBucket>();

    for (const doubt of doubts) {
      const label = doubt.subject.trim();
      const key = label.toUpperCase();
      const engagement =
        doubt.views + 2 * doubt.upVoteCount + 2 * doubt.answerCount;

      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          key,
          label,
          count: 1,
          engagementScore: engagement,
          newestAt: doubt.createdAt.getTime(),
          topDoubts: [doubt],
        });
        continue;
      }

      existing.count += 1;
      existing.engagementScore += engagement;
      existing.newestAt = Math.max(
        existing.newestAt,
        doubt.createdAt.getTime(),
      );
      existing.topDoubts.push(doubt);
    }

    const topics = Array.from(buckets.values())
      .map((bucket) => {
        const topDoubts = bucket.topDoubts
          .sort((a, b) => {
            const aScore = a.views + 2 * a.upVoteCount + 2 * a.answerCount;
            const bScore = b.views + 2 * b.upVoteCount + 2 * b.answerCount;
            if (bScore !== aScore) return bScore - aScore;
            return b.createdAt.getTime() - a.createdAt.getTime();
          })
          .slice(0, 3)
          .map((d) => ({
            id: d.id,
            title: d.title,
            views: d.views,
            upVoteCount: d.upVoteCount,
            answerCount: d.answerCount,
          }));

        return {
          key: bucket.key,
          label: bucket.label,
          count: bucket.count,
          engagementScore: bucket.engagementScore,
          topDoubts,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.engagementScore !== a.engagementScore) {
          return b.engagementScore - a.engagementScore;
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, 10);

    res.json({
      window,
      generatedAt: now.toISOString(),
      topics,
    });
  } catch (error) {
    console.error("Error fetching SubjectWise doubts analytics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 12. Get a single doubt by ID with all answers
export const getDoubtById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const doubt = await prisma.doubt.findFirst({
      where: {
        id,
        postedBy: { university: req.user!.university },
      },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
        answers: {
          include: {
            answeredBy: {
              select: {
                id: true,
                name: true,
                userID: true,
                role: true,
                facultyProfile: {
                  select: {
                    department: true,
                    subjects: true,
                  },
                },
                studentProfile: {
                  select: {
                    semester: true,
                    branch: true,
                  },
                },
              },
            },
            moderatedBy: {
              select: {
                id: true,
                name: true,
                userID: true,
                role: true,
              },
            },
          },
          orderBy: [
            { isAccepted: "desc" },
            { isVerified: "desc" },
            { upvotes: "desc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    try {
      const existingView = await prisma.doubtView.findUnique({
        where: { doubtId_userId: { doubtId: id, userId } },
      });

      if (!existingView) {
        await prisma.$transaction([
          prisma.doubtView.create({ data: { doubtId: id, userId } }),
          prisma.doubt.update({
            where: { id },
            data: { views: { increment: 1 } },
          }),
        ]);
      }
    } catch (viewError: any) {
      if (viewError?.code !== "P2002") {
        console.error("Error tracking doubt view:", viewError);
      }
    }

    const userUpvotes = await prisma.answerUpvote.findMany({
      where: {
        userId,
        answerId: {
          in: doubt.answers.map((a) => a.id),
        },
      },
      select: {
        answerId: true,
      },
    });

    const upvotedAnswerIds = new Set(userUpvotes.map((uv) => uv.answerId));

    const visibleAnswers = doubt.answers.filter(
      (answer) =>
        answer.approvalStatus === ApprovalStatus.APPROVED ||
        answer.answeredById === userId,
    );

    const answersWithUpvoteStatus = visibleAnswers.map((answer) => ({
      ...answer,
      isUpvotedByUser: upvotedAnswerIds.has(answer.id),
    }));

    let doubtUpvote: { id: string } | null = null;
    try {
      doubtUpvote = await prisma.doubtUpvote.findUnique({
        where: {
          doubtId_userId: {
            doubtId: id,
            userId,
          },
        },
        select: { id: true },
      });
    } catch (upvoteReadError) {
      // Backward compatibility: allow doubt details even if upvote table migration isn't applied yet.
      if (!isDoubtUpvoteSchemaMissingError(upvoteReadError)) {
        throw upvoteReadError;
      }
    }

    res.json({
      doubt: {
        ...doubt,
        answers: answersWithUpvoteStatus,
        isUpvotedByUser: Boolean(doubtUpvote),
      },
    });
  } catch (error) {
    console.error("Error fetching doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 13. Edit a doubt
export const editDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, subject, labels } = req.body;

    const existingDoubt = await prisma.doubt.findUnique({
      where: { id },
    });

    if (!existingDoubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (existingDoubt.postedById !== req.user!.id) {
      res.status(403).json({ error: "You can only edit your own doubts" });
      return;
    }

    const editHistory = Array.isArray(existingDoubt.editHistory)
      ? existingDoubt.editHistory
      : [];

    editHistory.push({
      title: existingDoubt.title,
      description: existingDoubt.description,
      editedAt: new Date().toISOString(),
    });

    const doubt = await prisma.doubt.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(subject && { subject }),
        ...(labels && { labels }),
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Doubt updated successfully", doubt });
  } catch (error) {
    console.error("Error editing doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 14. Delete a doubt
export const deleteDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check if doubt exists and belongs to the user
    const existingDoubt = await prisma.doubt.findUnique({
      where: { id },
    });

    if (!existingDoubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (existingDoubt.postedById !== req.user!.id) {
      res.status(403).json({ error: "You can only delete your own doubts" });
      return;
    }

    // Delete doubt (will cascade delete answers)
    await prisma.$transaction([
      prisma.answer.deleteMany({
        where: { doubtId: id },
      }),
      prisma.doubt.delete({
        where: { id },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          doubtsAsked: { decrement: 1 },
        },
      }),
    ]);

    res.json({ message: "Doubt deleted successfully" });
  } catch (error) {
    console.error("Error deleting doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 15. Mark an answer as accepted (only by doubt owner)
export const markAnswerAsAccepted = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const answerId = req.params.answerId as string;

    // Check if doubt exists and belongs to the user
    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (doubt.postedById !== req.user!.id) {
      res
        .status(403)
        .json({ error: "Only the doubt owner can accept answers" });
      return;
    }

    // Check if answer exists and belongs to the doubt
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!answer || answer.doubtId !== doubtId) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    // Check if this answer is already accepted
    const isCurrentlyAccepted = answer.isAccepted;

    let updatedAnswer;
    let updatedDoubt;
    let message;

    if (isCurrentlyAccepted) {
      // Unaccept the answer
      [updatedAnswer, updatedDoubt] = await prisma.$transaction([
        prisma.answer.update({
          where: { id: answerId },
          data: { isAccepted: false },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: {
            acceptedAnswerId: null,
            status:
              doubt.answerCount > 0 ? DoubtStatus.ANSWERED : DoubtStatus.OPEN,
          },
        }),
      ]);

      // Decrement doubtsSolved for the answerer
      const answererProfile = await prisma.studentProfile.findUnique({
        where: { userId: answer.answeredById },
      });

      if (answererProfile && answererProfile.doubtsSolved > 0) {
        await prisma.studentProfile.update({
          where: { userId: answer.answeredById },
          data: { doubtsSolved: { decrement: 1 } },
        });
      }

      message = "Answer unaccepted successfully";
    } else {
      // If there was a previously accepted answer, unmark it
      if (doubt.acceptedAnswerId) {
        await prisma.answer.update({
          where: { id: doubt.acceptedAnswerId },
          data: { isAccepted: false },
        });

        // Decrement doubtsSolved for the previous answerer
        const previousAnswer = await prisma.answer.findUnique({
          where: { id: doubt.acceptedAnswerId },
        });
        if (previousAnswer) {
          const previousAnswererProfile =
            await prisma.studentProfile.findUnique({
              where: { userId: previousAnswer.answeredById },
            });
          if (
            previousAnswererProfile &&
            previousAnswererProfile.doubtsSolved > 0
          ) {
            await prisma.studentProfile.update({
              where: { userId: previousAnswer.answeredById },
              data: { doubtsSolved: { decrement: 1 } },
            });
          }
        }
      }

      // Mark the new answer as accepted and update doubt status
      [updatedAnswer, updatedDoubt] = await prisma.$transaction([
        prisma.answer.update({
          where: { id: answerId },
          data: { isAccepted: true },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: {
            acceptedAnswerId: answerId,
            status: DoubtStatus.RESOLVED,
          },
        }),
      ]);

      // Update student profile - increment doubtsSolved for the answerer
      const answererProfile = await prisma.studentProfile.findUnique({
        where: { userId: answer.answeredById },
      });

      if (answererProfile) {
        await prisma.studentProfile.update({
          where: { userId: answer.answeredById },
          data: { doubtsSolved: { increment: 1 } },
        });
      }

      message = "Answer marked as accepted";
    }

    res.json({
      message,
      answer: updatedAnswer,
      doubt: updatedDoubt,
    });
  } catch (error) {
    console.error("Error toggling answer acceptance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16. Upvote an answer (toggle)
export const upvoteAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;
    const userId = req.user?.id as string;

    // Check if user has already upvoted this answer
    const existingUpvote = await prisma.answerUpvote.findUnique({
      where: {
        answerId_userId: {
          answerId,
          userId,
        },
      },
    });

    let answer;
    let message;

    if (existingUpvote) {
      // User has already upvoted, so remove the upvote (decrement)
      await prisma.answerUpvote.delete({
        where: {
          id: existingUpvote.id,
        },
      });

      answer = await prisma.answer.update({
        where: { id: answerId },
        data: { upvotes: { decrement: 1 } },
      });

      // Also update the doubt's upvote count
      await prisma.doubt.update({
        where: { id: answer.doubtId },
        data: { upVoteCount: { decrement: 1 } },
      });

      message = "Answer upvote removed successfully";
    } else {
      // User hasn't upvoted yet, so add the upvote (increment)
      await prisma.answerUpvote.create({
        data: {
          answerId,
          userId,
        },
      });

      answer = await prisma.answer.update({
        where: { id: answerId },
        data: { upvotes: { increment: 1 } },
      });

      // Also update the doubt's upvote count
      await prisma.doubt.update({
        where: { id: answer.doubtId },
        data: { upVoteCount: { increment: 1 } },
      });

      message = "Answer upvoted successfully";
    }

    res.json({ message, answer, isUpvoted: !existingUpvote });
  } catch (error) {
    console.error("Error toggling answer upvote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16b. Upvote a doubt (toggle)
export const upvoteDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const userId = req.user?.id as string;

    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      include: {
        postedBy: {
          select: {
            university: true,
          },
        },
      },
    });

    if (!doubt || doubt.postedBy.university !== req.user!.university) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    const existingUpvote = await prisma.doubtUpvote.findUnique({
      where: {
        doubtId_userId: {
          doubtId,
          userId,
        },
      },
    });

    let message: string;
    let updatedDoubt;

    if (existingUpvote) {
      [, updatedDoubt] = await prisma.$transaction([
        prisma.doubtUpvote.delete({
          where: {
            id: existingUpvote.id,
          },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upVoteCount: { decrement: 1 } },
        }),
      ]);
      message = "Doubt upvote removed successfully";
    } else {
      [, updatedDoubt] = await prisma.$transaction([
        prisma.doubtUpvote.create({
          data: {
            doubtId,
            userId,
          },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upVoteCount: { increment: 1 } },
        }),
      ]);
      message = "Doubt upvoted successfully";
    }

    res.json({
      message,
      doubt: updatedDoubt,
      isUpvoted: !existingUpvote,
      upVoteCount: updatedDoubt.upVoteCount,
    });
  } catch (error) {
    if (isDoubtUpvoteSchemaMissingError(error)) {
      res.status(503).json({
        error:
          "Doubt upvote feature is temporarily unavailable until database migration is applied",
      });
      return;
    }
    console.error("Error toggling doubt upvote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 17. Post an answer to a doubt (students can also answer)
export const postAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Check if doubt exists
    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      include: { postedBy: true }, // Include who posted the doubt for notifications
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    // Get the current user's info for notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });

    // Create answer and update doubt
    const [answer] = await prisma.$transaction([
      prisma.answer.create({
        data: {
          content,
          doubtId,
          answeredById: req.user!.id,
          approvalStatus: ApprovalStatus.PENDING,
        },
        include: {
          answeredBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              role: true,
              studentProfile: {
                select: {
                  semester: true,
                  branch: true,
                },
              },
            },
          },
          moderatedBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              role: true,
            },
          },
        },
      }),
      prisma.doubt.update({
        where: { id: doubtId },
        data: {
          answerCount: { increment: 1 },
          status: DoubtStatus.ANSWERED,
        },
      }),
    ]);

    // Note: Notification is sent only when answer is approved by faculty,
    // not when posted (to avoid notifying about pending answers)

    res.status(201).json({ message: "Answer posted successfully", answer });
  } catch (error) {
    console.error("Error posting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 18. Edit an answer
export const editAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Check if answer exists and belongs to the user
    const existingAnswer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!existingAnswer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    if (existingAnswer.answeredById !== req.user!.id) {
      res.status(403).json({ error: "You can only edit your own answers" });
      return;
    }

    if (existingAnswer.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({
        error:
          "You can only edit your answer before faculty approves or rejects it",
      });
      return;
    }

    // Create edit history entry
    const editHistory = Array.isArray(existingAnswer.editHistory)
      ? existingAnswer.editHistory
      : [];

    editHistory.push({
      content: existingAnswer.content,
      editedAt: new Date().toISOString(),
    });

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        content,
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Answer updated successfully", answer });
  } catch (error) {
    console.error("Error editing answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 18b. Delete answer
export const deleteAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;

    // Check if answer exists and belongs to the user
    const existingAnswer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!existingAnswer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    if (existingAnswer.answeredById !== req.user!.id) {
      res.status(403).json({ error: "You can only delete your own answers" });
      return;
    }

    if (existingAnswer.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({
        error:
          "You can only delete your answer before faculty approves or rejects it",
      });
      return;
    }

    // Get the doubt to update counts
    const doubt = await prisma.doubt.findUnique({
      where: { id: existingAnswer.doubtId },
    });

    if (!doubt) {
      res.status(404).json({ error: "Associated doubt not found" });
      return;
    }

    // Delete the answer (this will cascade delete answer upvotes due to onDelete: Cascade)
    await prisma.answer.delete({
      where: { id: answerId },
    });

    // Update doubt's answer count and upvote count
    await prisma.doubt.update({
      where: { id: existingAnswer.doubtId },
      data: {
        answerCount: { decrement: 1 },
        upVoteCount: { decrement: existingAnswer.upvotes },
        // If this was the accepted answer, clear it and update status
        ...(doubt.acceptedAnswerId === answerId
          ? {
              acceptedAnswerId: null,
              status: DoubtStatus.OPEN,
            }
          : {}),
      },
    });

    // If the answer was accepted, decrement the answerer's doubtsSolved
    if (existingAnswer.isAccepted) {
      const answererProfile = await prisma.studentProfile.findUnique({
        where: { userId: existingAnswer.answeredById },
      });

      if (answererProfile && answererProfile.doubtsSolved > 0) {
        await prisma.studentProfile.update({
          where: { userId: existingAnswer.answeredById },
          data: { doubtsSolved: { decrement: 1 } },
        });
      }
    }

    res.json({ message: "Answer deleted successfully" });
  } catch (error) {
    console.error("Error deleting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 19. Get student's own doubts
export const getMyDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubts = await prisma.doubt.findMany({
      where: { postedById: req.user!.id },
      include: {
        _count: {
          select: {
            answers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ doubts });
  } catch (error) {
    console.error("Error fetching my doubts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 20. Get student's own answers across all doubts
export const getMyAnswers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answers = await prisma.answer.findMany({
      where: { answeredById: req.user!.id },
      include: {
        moderatedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
          },
        },
        doubt: {
          select: {
            id: true,
            title: true,
            subject: true,
            status: true,
            semester: true,
            postedBy: {
              select: {
                name: true,
                userID: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ answers });
  } catch (error) {
    console.error("Error fetching my answers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 21. Get student's own answer for a specific doubt
export const getMyAnswerForDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;

    const answer = await prisma.answer.findFirst({
      where: {
        doubtId,
        answeredById: req.user!.id,
      },
      include: {
        moderatedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!answer) {
      res.status(404).json({ error: "You haven't answered this doubt yet" });
      return;
    }

    res.json({ answer });
  } catch (error) {
    console.error("Error fetching my answer for doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 22. Confirm Complaint Resolution
export const confirmComplaintResolution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;

    console.log("Confirming resolution for complaint:", complaintId);

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    // Verify complaint exists and belongs to the student
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { assignedTo: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res
        .status(403)
        .json({ error: "You can only confirm your own complaints" });
      return;
    }

    if (complaint.status !== "PENDING_CONFIRMATION") {
      res.status(400).json({
        error: "Complaint is not pending your approval",
      });
      return;
    }

    // Update complaint to RESOLVED and mark as confirmed
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: "RESOLVED",
        studentConfirmed: true,
        studentConfirmationDate: new Date(),
        handledBySuperAdmin: false, // Reset superadmin handling flag
      },
    });

    console.log("Complaint confirmed successfully:", updatedComplaint.id);

    // Send notification to the assigned faculty and admin
    try {
      if (complaint.assignedTo) {
        await notifyComplaintStatusChange(
          complaint.assignedToId!,
          complaint.title,
          complaint.status,
          "RESOLVED",
          complaintId,
        );
        console.log("Confirmation notification sent to faculty");
      }

      // Notify admin that complaint is resolved
      const admins = await prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await notifyComplaintStatusChange(
          admin.id,
          complaint.title,
          complaint.status,
          "RESOLVED",
          complaintId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error (non-blocking):", notificationError);
      // Don't fail the request if notifications fail
    }

    console.log("Sending confirmation success response");
    res.json({ message: "Complaint confirmed as resolved" });
  } catch (error) {
    console.error("Confirm complaint resolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 23. Reject Complaint Resolution
export const rejectComplaintResolution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { rejectionReason } = req.body;

    console.log(
      "Rejecting resolution for complaint:",
      complaintId,
      "Reason:",
      rejectionReason,
    );

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    if (!rejectionReason || rejectionReason.trim() === "") {
      res.status(400).json({ error: "Rejection reason is required" });
      return;
    }

    // Verify complaint exists and belongs to the student
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { assignedTo: true, raisedBy: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res
        .status(403)
        .json({ error: "You can only reject your own complaints" });
      return;
    }

    if (complaint.status !== "PENDING_CONFIRMATION") {
      res.status(400).json({
        error: "Complaint is not pending your approval",
      });
      return;
    }

    // Parse existing rejection history
    let rejectionHistory: RejectionHistoryEntry[] = [];
    try {
      rejectionHistory =
        typeof complaint.rejectionHistory === "string"
          ? JSON.parse(complaint.rejectionHistory)
          : Array.isArray(complaint.rejectionHistory)
            ? complaint.rejectionHistory
            : [];
    } catch {
      rejectionHistory = [];
    }

    // Add new rejection to history
    rejectionHistory.push({
      timestamp: new Date().toISOString(),
      reason: rejectionReason,
      studentName: complaint.raisedBy.name,
    });

    const escalatedStatus = complaint.assignedToId ? "ASSIGNED" : "RAISED";

    // Flag complaint for Super Admin re-review using escalation count.
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: escalatedStatus,
        studentRejectionMessage: rejectionReason,
        escalationCount: { increment: 1 },
        rejectionHistory: rejectionHistory as unknown as Prisma.InputJsonValue,
        resolutionNote: rejectionReason
          ? `${complaint.resolutionNote || ""}\n\n[${new Date().toLocaleString()}] Student Rejection: ${rejectionReason}`
          : complaint.resolutionNote,
      },
    });

    console.log("Complaint rejected and escalated:", updatedComplaint.id);

    // Send notifications
    try {
      // Notify the assigned faculty about rejection
      if (complaint.assignedTo) {
        await notifyComplaintStatusChange(
          complaint.assignedToId!,
          complaint.title,
          complaint.status,
          escalatedStatus,
          complaintId,
        );
        console.log("Notification sent to faculty");
      }

      // Notify all superadmins about the escalation
      const superAdmins = await prisma.user.findMany({
        where: {
          role: Role.SUPER_ADMIN,
          isActive: true,
        },
        select: { id: true },
      });

      console.log(`Found ${superAdmins.length} superadmins to notify`);

      for (const superAdmin of superAdmins) {
        await createNotification({
          userId: superAdmin.id,
          type: "COMPLAINT_STATUS_UPDATE",
          title: "Complaint Rejected by Student - Escalated",
          message: `Complaint "${complaint.title}" was rejected by student ${complaint.raisedBy.name}. Reason: ${rejectionReason}`,
          data: {
            complaintId,
            oldStatus: complaint.status,
            newStatus: escalatedStatus,
            rejectionReason,
            escalationCount: updatedComplaint.escalationCount,
            escalatedForSuperAdminReview: true,
          },
        });
      }

      console.log("Escalation notifications sent to superadmins");
    } catch (notificationError) {
      console.error("Notification error (non-blocking):", notificationError);
      // Don't fail the request if notification fails
    }

    console.log("Sending success response");
    res.json({
      message:
        "Complaint resolution rejected and escalated to Super Admin for review",
    });
  } catch (error) {
    console.error("Reject complaint resolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 24. Submit Complaint Feedback (Student)
export const submitComplaintFeedback = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { feedbackRating, feedbackComment } = req.body as {
      feedbackRating?: unknown;
      feedbackComment?: unknown;
    };

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    if (
      typeof feedbackRating !== "number" ||
      !Number.isInteger(feedbackRating) ||
      feedbackRating < 1 ||
      feedbackRating > 5
    ) {
      res
        .status(400)
        .json({ error: "Feedback rating must be an integer between 1 and 5" });
      return;
    }

    if (
      feedbackComment !== undefined &&
      feedbackComment !== null &&
      typeof feedbackComment !== "string"
    ) {
      res.status(400).json({ error: "Feedback comment must be a string" });
      return;
    }

    const normalizedFeedbackComment =
      typeof feedbackComment === "string" ? feedbackComment.trim() : "";

    if (normalizedFeedbackComment.length > 1000) {
      res.status(400).json({ error: "Feedback comment is too long" });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        raisedById: true,
        status: true,
        feedbackRating: true,
      },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res.status(403).json({
        error: "You can only submit feedback for your own complaints",
      });
      return;
    }

    if (complaint.status !== "RESOLVED") {
      res.status(400).json({
        error: "Feedback can only be submitted after complaint is resolved",
      });
      return;
    }

    if (complaint.feedbackRating !== null) {
      res
        .status(400)
        .json({ error: "Feedback already submitted for this complaint" });
      return;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        feedbackRating,
        feedbackComment: normalizedFeedbackComment || null,
      },
    });

    res.json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Submit complaint feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
