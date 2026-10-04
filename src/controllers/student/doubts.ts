/**
 * The doubt community from the asker's side: posting, browsing, editing, tags, bookmarks, image doubts.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  AttachmentEntity,
  DoubtStatus,
  Prisma
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  requestEmbedding,
  triggerDrainInBackground,
} from "../../services/ai/embeddingWorker.js";
import {
  extractInlineImageIds,
  prepareContent,
  prepareEdit,
} from "../../services/content/sanitize.js";
import {
  ReputationReason,
  awardReputation,
  revokeReputation,
} from "../../services/reputation/reputation.js";
import { hybridSearchDoubts } from "../../services/search/hybridSearch.js";
import {
  AttachmentError,
  bindPostAttachments,
  listForEntities
} from "../../services/storage/attachments.js";
import {
  VisionExtractionError,
  extractDoubtFromImage,
} from "../../services/vision/extractDoubt.js";
import type { AuthRequest } from "../../types/index.js";
import {
  TagError,
  buildVocabulary,
  parseTagQuery,
  prepareTags,
} from "../../utils/tags.js";
import { CommonDoubtTopicBucket, CommonDoubtsWindow, getPostingSettings, isDoubtUpvoteSchemaMissingError, readBookmarkedIds } from "./shared.js";

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
    const excludeId =
      typeof req.query.excludeId === "string"
        ? req.query.excludeId.trim()
        : undefined;

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

    // Short queries produce noise and would spend provider quota on nothing.
    if (query.length < 3) {
      res.json({ suggestions: [] });
      return;
    }

    // CC-11: keyword + full-text + vector, fused with RRF. Degrades to whatever
    // retrievers are available - a provider outage must never break search.
    const { doubts, used, degraded } = await hybridSearchDoubts(query, {
      subject,
      semester,
      excludeId,
      limit,
    });

    res.json({
      suggestions: doubts.map((doubt) => ({
        id: doubt.id,
        title: doubt.title,
        subject: doubt.subject,
        semester: doubt.semester,
        views: doubt.views,
        answerCount: doubt._count.answers,
        createdAt: doubt.createdAt.toISOString(),
        matchedKeywords: doubt.matchedKeywords,
      })),
      // Additive fields; existing clients ignore them.
      retrievers: used,
      degraded,
    });
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
    const {
      title,
      description,
      semester,
      subject,
      labels,
      attachmentIds,
      descriptionFormat,
      transcribedFromImage,
      transcriptionModel,
    } = req.body;

    // CC-23: sanitised HERE, on the server, on write. The editor is a
    // convenience - this endpoint accepts whatever a client sends, and
    // sanitising on read would leave the dangerous string in the database.
    const preparedDescription = prepareContent(description, descriptionFormat);

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

    // Create doubt and update student profile in a transaction
    const [doubt] = await prisma.$transaction([
      prisma.doubt.create({
        data: {
          title,
          description: preparedDescription.value,
          descriptionFormat: preparedDescription.format,
          semester,
          subject,
          // CC-20: both columns from one helper so they cannot drift.
          ...prepareTags(labels),
          // CC-50: provenance, coerced rather than trusted. A client could
          // claim any model name, so the string is bounded and only recorded
          // when the flag is actually set - a label on the doubt, never an
          // input to any decision.
          transcribedFromImage: transcribedFromImage === true,
          transcriptionModel:
            transcribedFromImage === true &&
            typeof transcriptionModel === "string"
              ? transcriptionModel.trim().slice(0, 100) || null
              : null,
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

    // CC-10: queue the doubt for embedding, then return immediately.
    // Never inline: a provider cold start is 20+ seconds, and an AI outage must
    // CC-24: bind any uploaded files now the doubt exists and has an id,
    // including images placed inline in the body (CC-23). Inert while CC-02 is
    // dormant - confirmAttachments refuses with a 503 that the catch below
    // turns into a clean error rather than a 500.
    await bindPostAttachments({
      entityType: AttachmentEntity.DOUBT,
      entityId: doubt.id,
      userId: req.user!.id,
      attachmentIds,
      inlineImageIds: extractInlineImageIds(preparedDescription.value),
    });

    // never stop a student posting a doubt. requestEmbedding does not throw.
    await requestEmbedding("doubt", doubt.id);
    triggerDrainInBackground();

    res.status(201).json({ message: "Doubt posted successfully", doubt });
  } catch (error) {
    if (error instanceof TagError || error instanceof AttachmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

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

    const where: Prisma.DoubtWhereInput = {};

    // CC-20: ?tag=recursion, repeatable. Both sides go through normalizeTag,
    // so this stays an exact match against the GIN-indexed column.
    //
    // hasEvery, not hasSome: a student narrowing a list expects each added tag
    // to show FEWER results.
    const tags = parseTagQuery(req.query.tag);
    if (tags.length > 0) {
      where.labelsNormalized = { hasEvery: tags };
    }

    const doubtStatuses: DoubtStatus[] = [
      DoubtStatus.OPEN,
      DoubtStatus.ANSWERED,
      DoubtStatus.RESOLVED,
    ];
    if (
      status &&
      doubtStatuses.includes(String(status).trim() as DoubtStatus)
    ) {
      where.status = String(status).trim() as DoubtStatus;
    }

    if (subject && String(subject).trim()) {
      where.subject = String(subject).trim();
    }

    if (semester !== undefined && semester !== null && String(semester).trim() !== "") {
      const sem = parseInt(String(semester), 10);
      if (Number.isFinite(sem)) {
        where.semester = sem;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const doubts = await prisma.doubt.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
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

    // CC-21: one batched lookup, not one per doubt. Tolerates the table not
    // existing for the same reason the upvote read above does - the migration
    // may not have been applied yet, and that must not break the feed.
    const bookmarkedDoubtIds = await readBookmarkedIds(
      req.user!.id,
      doubts.map((doubt) => doubt.id),
    );

    res.json({
      doubts: doubts.map((doubt) => ({
        ...doubt,
        isUpvotedByUser: upvotedDoubtIds.has(doubt.id),
        isBookmarkedByUser: bookmarkedDoubtIds.has(doubt.id),
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
        }
      : {};

    const doubts = await prisma.doubt.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
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
                // CC-25: shown beside the author, which is where reputation
                // actually does its job - a leaderboard nobody opens does not
                // help a reader judge an answer.
                reputation: true,
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
                // CC-25: shown beside the author, which is where reputation
                // actually does its job - a leaderboard nobody opens does not
                // help a reader judge an answer.
                reputation: true,
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

    // CC-21: same missing-table tolerance as the upvote read above.
    const bookmarkedIds = await readBookmarkedIds(userId, [id]);

    // CC-24: the doubt's own files, and each answer's. Batched, and empty
    // while CC-02 is dormant - listForEntities returns an empty map without
    // querying when storage is off.
    const [doubtFiles, answerFiles] = await Promise.all([
      listForEntities(AttachmentEntity.DOUBT, [id]),
      listForEntities(
        AttachmentEntity.ANSWER,
        answersWithUpvoteStatus.map((answer) => answer.id),
      ),
    ]);

    const fileSummary = (rows: Array<Record<string, unknown>> = []) =>
      rows.map(({ id: fileId, mimeType, originalName, sizeBytes }) => ({
        id: fileId,
        mimeType,
        originalName,
        sizeBytes,
      }));

    res.json({
      doubt: {
        ...doubt,
        answers: answersWithUpvoteStatus.map((answer) => ({
          ...answer,
          attachments: fileSummary(
            answerFiles.get(answer.id) as unknown as Array<Record<string, unknown>>,
          ),
        })),
        attachments: fileSummary(
          doubtFiles.get(id) as unknown as Array<Record<string, unknown>>,
        ),
        isUpvotedByUser: Boolean(doubtUpvote),
        isBookmarkedByUser: bookmarkedIds.has(id),
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

    // CC-23: sanitised in the format the doubt was stored as. Writing the
    // body raw here let an HTML doubt be edited into stored XSS.
    const preparedDescription = description
      ? prepareEdit(description, existingDoubt.descriptionFormat)
      : undefined;

    // Bound before the write: an edit naming an image the student cannot
    // bind must fail without changing the doubt.
    if (preparedDescription) {
      await bindPostAttachments({
        entityType: AttachmentEntity.DOUBT,
        entityId: id,
        userId: req.user!.id,
        inlineImageIds: extractInlineImageIds(preparedDescription),
      });
    }

    const doubt = await prisma.doubt.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(preparedDescription && { description: preparedDescription }),
        ...(subject && { subject }),
        ...(labels ? prepareTags(labels) : {}),
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Doubt updated successfully", doubt });
  } catch (error) {
    if (error instanceof TagError || error instanceof AttachmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

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
    });

    if (!doubt) {
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
      await revokeReputation({
        userId: updatedDoubt.postedById,
        reason: ReputationReason.DOUBT_UPVOTED,
        sourceType: "Doubt",
        sourceId: doubtId,
        actorId: userId,
      });

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
      // CC-25: asking a question others share has value, at a fifth the rate
      // of answering one. A forum where asking scores well fills with
      // questions and empties of answers.
      await awardReputation({
        userId: updatedDoubt.postedById,
        reason: ReputationReason.DOUBT_UPVOTED,
        sourceType: "Doubt",
        sourceId: doubtId,
        actorId: userId,
      });

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
    // A double tap: the other request already made this change (P2002 on
    // create, P2025 on delete). Report the state it left, not a 500.
    const code = (error as { code?: string }).code;
    if (code === "P2002" || code === "P2025") {
      const current = await prisma.doubt.findUnique({
        where: { id: req.params.doubtId as string },
        select: { upVoteCount: true },
      });
      res.json({
        message: "Doubt upvote already updated",
        isUpvoted: code === "P2002",
        upVoteCount: current?.upVoteCount ?? 0,
      });
      return;
    }
    console.error("Error toggling doubt upvote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 19. Get student's own doubts
export const getMyDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Return all doubts so students see the same global list
    const doubts = await prisma.doubt.findMany({
      where: {},
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

/* ------------------------------------------------------------------ *
 * CC-20: tag vocabulary
 * ------------------------------------------------------------------ */

/**
 * Every tag in use, with its canonical display casing and a count.
 *
 * Deliberately UNCAPPED. An earlier draft returned the top 50 by count, which
 * is right for an autocomplete and wrong for a display map: a long-tail tag
 * missing from the response would fall back to its raw casing, and the casing
 * divergence this endpoint exists to remove would survive in exactly the
 * places nobody checks. The full list is a few hundred short strings - smaller
 * than one doubt's description. The client slices the top N for suggestions.
 */
export const getDoubtTags = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const rows = await prisma.doubt.findMany({
      select: { labels: true, labelsNormalized: true },
    });

    res.json({ tags: buildVocabulary(rows) });
  } catch (error) {
    console.error("Error fetching doubt tags:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ------------------------------------------------------------------ *
 * CC-21: bookmarks
 * ------------------------------------------------------------------ */

/**
 * Save a doubt. Idempotent: saving twice is 200, not 409.
 *
 * This is a toggle behind a button students will double-tap on bad campus
 * wifi. An error on the second tap is noise, not information, and the
 * composite unique index means the database enforces single-row regardless.
 */
export const bookmarkDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;

    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      select: { id: true },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    await prisma.doubtBookmark.upsert({
      where: { doubtId_userId: { doubtId, userId: req.user!.id } },
      create: { doubtId, userId: req.user!.id },
      update: {},
    });

    res.json({ bookmarked: true });
  } catch (error) {
    console.error("Error bookmarking doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Remove a save. Idempotent: removing one that is not there is 200. */
export const unbookmarkDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    await prisma.doubtBookmark.deleteMany({
      where: {
        doubtId: req.params.doubtId as string,
        userId: req.user!.id,
      },
    });

    res.json({ bookmarked: false });
  } catch (error) {
    console.error("Error removing bookmark:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * The caller's saved doubts, newest save first.
 *
 * Scoped by req.user.id and never by anything the client sends - a bookmark
 * list is private, and this is the only query that could leak one.
 */
export const getBookmarkedDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const bookmarks = await prisma.doubtBookmark.findMany({
      where: { userId: req.user!.id },
      orderBy: { savedAt: "desc" },
      select: { doubtId: true, savedAt: true },
    });

    if (bookmarks.length === 0) {
      res.json({ doubts: [] });
      return;
    }

    const doubts = await prisma.doubt.findMany({
      where: { id: { in: bookmarks.map((bookmark) => bookmark.doubtId) } },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: { select: { semester: true, branch: true } },
          },
        },
        _count: { select: { answers: true } },
      },
    });

    // Ordered by when the user saved it, not when it was posted, so the list
    // reads as "what I put here" rather than as another feed.
    const byId = new Map(doubts.map((doubt) => [doubt.id, doubt]));

    res.json({
      doubts: bookmarks
        .map((bookmark) => {
          const doubt = byId.get(bookmark.doubtId);
          return doubt
            ? { ...doubt, savedAt: bookmark.savedAt, isBookmarkedByUser: true }
            : null;
        })
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Error fetching bookmarked doubts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-50: read a doubt out of an uploaded image.
 *
 * Advisory, exactly like CC-14's complaint parser. The student has already
 * uploaded the image through CC-02, so this takes an attachment id rather than
 * bytes — the size cap, the MIME allow-list and the ownership check all live
 * in one place that way.
 *
 * The response is a draft for the form, never a posted doubt. Auto-posting a
 * transcription would publish text the student has not read, under their name,
 * to a community that upvotes it.
 *
 * Unlike `parseComplaint`, this does NOT degrade to an empty suggestion on
 * failure. A student who asked for the image to be read and silently got a
 * blank form would conclude the upload failed. The distinct statuses
 * (503 unavailable, 422 illegible, 400 wrong format) each tell them what to do.
 */
export const readDoubtFromImage = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { attachmentId } = req.body as { attachmentId?: unknown };

    if (typeof attachmentId !== "string" || attachmentId.trim() === "") {
      res.status(400).json({ error: "attachmentId is required." });
      return;
    }

    const draft = await extractDoubtFromImage({
      attachmentId: attachmentId.trim(),
      userId: req.user!.id,
    });

    res.json(draft);
  } catch (error) {
    if (error instanceof VisionExtractionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("[CC-50] reading doubt from image failed:", error);
    res
      .status(500)
      .json({ error: "Could not read the image. Please type your question." });
  }
};
