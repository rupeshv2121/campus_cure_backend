/**
 * CC-12 AI answer drafts: reviewing, approving and rejecting.
 *
 * Split out of facultyController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  DoubtStatus
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import { generateDraftForDoubt } from "../../services/ai/answerDraft.js";
import type { AuthRequest } from "../../types/index.js";

/* ------------------------------------------------------------------ *
 * CC-12: AI answer drafts
 *
 * Faculty-only throughout. No student-facing handler reads AnswerDraft, so a
 * draft is structurally incapable of reaching a student before approval.
 * ------------------------------------------------------------------ */

/** The pending draft for a doubt, if one exists. */
export const getAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({
      where: { doubtId },
      select: {
        id: true,
        content: true,
        model: true,
        sourceIds: true,
        status: true,
        createdAt: true,
      },
    });

    if (!draft || draft.status !== "PENDING") {
      res.json({ draft: null });
      return;
    }

    // Hydrate the grounding so a reviewer can audit what the draft drew on
    // rather than taking it on trust.
    const sources = await prisma.answer.findMany({
      where: { id: { in: draft.sourceIds } },
      select: {
        id: true,
        content: true,
        doubt: { select: { id: true, title: true } },
      },
    });

    res.json({
      draft: {
        id: draft.id,
        content: draft.content,
        model: draft.model,
        createdAt: draft.createdAt.toISOString(),
        sources: sources.map((source) => ({
          answerId: source.id,
          doubtId: source.doubt.id,
          doubtTitle: source.doubt.title,
          excerpt: source.content.slice(0, 300),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Approve a draft, optionally edited.
 *
 * Creates a real Answer **authored by the reviewing faculty member** — they put
 * their name to it and take responsibility. `aiAssisted` is recorded
 * permanently, and `editedOnApproval` makes rubber-stamping measurable.
 */
export const approveAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    const { content } = req.body as { content?: string };

    if (!doubtId || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Answer content is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({ where: { doubtId } });

    if (!draft || draft.status !== "PENDING") {
      res.status(404).json({ error: "No pending draft for this doubt" });
      return;
    }

    const finalContent = content.trim();
    const edited = finalContent !== draft.content.trim();

    const [answer] = await prisma.$transaction([
      prisma.answer.create({
        data: {
          doubtId,
          content: finalContent,
          answeredById: req.user!.id,
          approvalStatus: ApprovalStatus.APPROVED,
          aiAssisted: true,
        },
        select: { id: true, content: true, createdAt: true },
      }),
      prisma.answerDraft.update({
        where: { doubtId },
        data: {
          status: "APPROVED",
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          editedOnApproval: edited,
        },
      }),
      prisma.doubt.update({
        where: { id: doubtId },
        data: { answerCount: { increment: 1 }, status: DoubtStatus.ANSWERED },
      }),
    ]);

    res.status(201).json({
      message: "Draft approved and published",
      answer,
      editedOnApproval: edited,
    });
  } catch (error) {
    console.error("Error approving answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Reject a draft. No Answer is created. */
export const rejectAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    const { note } = req.body as { note?: string };

    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({ where: { doubtId } });
    if (!draft || draft.status !== "PENDING") {
      res.status(404).json({ error: "No pending draft for this doubt" });
      return;
    }

    await prisma.answerDraft.update({
      where: { doubtId },
      data: {
        status: "REJECTED",
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        reviewNote: typeof note === "string" ? note.slice(0, 500) : null,
      },
    });

    res.json({ message: "Draft rejected" });
  } catch (error) {
    console.error("Error rejecting answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Generate a draft on demand for a specific doubt. Faculty only. */
export const requestAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      select: { id: true, title: true, description: true, subject: true },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    const result = await generateDraftForDoubt(doubt);
    res.json(result);
  } catch (error) {
    console.error("Error generating answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
