/**
 * Retrieval-grounded answer drafts — CC-12.
 *
 * A draft is synthesised from approved answers to semantically similar doubts,
 * never generated free-hand. Three reasons: lower hallucination, answers that
 * reflect how this campus actually teaches a topic, and an audit trail of
 * sources a reviewer can check.
 *
 * **If retrieval finds no grounding, no draft is produced.** A grounded-answer
 * feature that free-generates when it finds nothing is just free generation
 * with extra steps.
 *
 * See docs/specs/CC-12-ai-answer-draft.md.
 */
import {
  AI_ENABLED,
  DRAFT_DELAY_HOURS,
  GROUNDING_SIMILARITY_THRESHOLD,
} from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { findSimilarDoubtsToDoubt } from "../../repositories/embeddingRepository.js";
import { completeWithFallback } from "./chat/index.js";

/** Approved answers pulled in as grounding. */
interface GroundingSource {
  answerId: string;
  doubtTitle: string;
  content: string;
}

export interface DraftResult {
  created: boolean;
  reason?: string;
}

const MAX_SOURCES = 3;
const MAX_SOURCE_CHARS = 1200;

const SYSTEM_PROMPT = [
  "You are helping a university faculty member draft an answer to a student's doubt.",
  "",
  "You will be given the student's doubt and some previously approved answers to",
  "similar doubts from the same institution. Base your answer on that material.",
  "",
  "Rules:",
  "- Answer only what the reference material supports. Do not invent facts,",
  "  figures, citations, or course specifics that are not present.",
  "- If the references only partly cover the doubt, answer that part and say",
  "  plainly which part you cannot address.",
  "- Write for a student: direct, concrete, and complete in a few short",
  "  paragraphs. Use an example when it genuinely aids understanding.",
  "- Do not greet, sign off, or mention that you are an AI.",
  "- Output only the answer text.",
].join("\n");

/**
 * Doubts eligible for a draft.
 *
 * The delay is deliberate: humans get first refusal. Without it CC-12 would
 * undercut the community CC-25 exists to build.
 */
export const findDoubtsNeedingDrafts = async (
  limit = 5,
): Promise<Array<{ id: string; title: string; description: string; subject: string }>> => {
  const cutoff = new Date(Date.now() - DRAFT_DELAY_HOURS * 60 * 60 * 1000);

  return prisma.doubt.findMany({
    where: {
      createdAt: { lt: cutoff },
      answers: { none: {} },
      // A doubt that already has a draft — pending, approved or rejected — is
      // not regenerated. Repeatedly drafting for a doubt faculty already
      // rejected would burn quota for nothing.
      AND: [{ NOT: { id: { in: await draftedDoubtIds() } } }],
    },
    select: { id: true, title: true, description: true, subject: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
};

const draftedDoubtIds = async (): Promise<string[]> => {
  const rows = await prisma.answerDraft.findMany({ select: { doubtId: true } });
  return rows.map((row) => row.doubtId);
};

/**
 * Approved answers to semantically similar doubts, via CC-11's hybrid search.
 * Returns an empty array when nothing relevant exists — which stops generation.
 */
const gatherGrounding = async (doubt: {
  id: string;
  title: string;
  description: string;
  subject: string;
}): Promise<GroundingSource[]> => {
  // A relevance FLOOR, not just a ranking. Uses the doubt's stored embedding,
  // so this costs no provider call.
  const similar = await findSimilarDoubtsToDoubt(doubt.id, {
    subject: doubt.subject,
    limit: MAX_SOURCES + 2,
    maxDistance: 1 - GROUNDING_SIMILARITY_THRESHOLD,
  });

  if (similar.length === 0) return [];

  const answers = await prisma.answer.findMany({
    where: {
      doubtId: { in: similar.map((d) => d.id) },
      approvalStatus: "APPROVED",
    },
    select: {
      id: true,
      content: true,
      isVerified: true,
      upvotes: true,
      doubt: { select: { title: true } },
    },
    // Verified and well-received answers make the best grounding.
    orderBy: [{ isVerified: "desc" }, { upvotes: "desc" }],
    take: MAX_SOURCES,
  });

  return answers.map((answer) => ({
    answerId: answer.id,
    doubtTitle: answer.doubt.title,
    content: answer.content.slice(0, MAX_SOURCE_CHARS),
  }));
};

const buildUserPrompt = (
  doubt: { title: string; description: string; subject: string },
  sources: GroundingSource[],
): string =>
  [
    `Subject: ${doubt.subject}`,
    `Student's doubt: ${doubt.title}`,
    "",
    doubt.description,
    "",
    "--- Previously approved answers to similar doubts ---",
    ...sources.map(
      (source, index) =>
        `\n[${index + 1}] (in reply to "${source.doubtTitle}")\n${source.content}`,
    ),
    "",
    "--- End of reference material ---",
    "",
    "Draft an answer to the student's doubt using only the material above.",
  ].join("\n");

/**
 * Generate and store one draft. Never throws — draft generation is an
 * enhancement and must not break whatever triggered it.
 */
export const generateDraftForDoubt = async (doubt: {
  id: string;
  title: string;
  description: string;
  subject: string;
}): Promise<DraftResult> => {
  if (!AI_ENABLED) return { created: false, reason: "AI disabled" };

  try {
    const sources = await gatherGrounding(doubt);

    if (sources.length === 0) {
      return { created: false, reason: "no grounding material found" };
    }

    const completion = await completeWithFallback(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(doubt, sources) },
      ],
      // Generous: reasoning models spend part of this before writing anything.
      { maxTokens: 1500, temperature: 0.3 },
    );

    if (!completion) {
      return { created: false, reason: "all chat providers failed" };
    }

    const content = completion.content.trim();
    if (!content) {
      // Belt and braces; the provider already rejects empty content.
      return { created: false, reason: "empty completion" };
    }

    await prisma.answerDraft.upsert({
      where: { doubtId: doubt.id },
      create: {
        doubtId: doubt.id,
        content,
        model: `${completion.provider}/${completion.model}`,
        sourceIds: sources.map((s) => s.answerId),
      },
      update: {
        content,
        model: `${completion.provider}/${completion.model}`,
        sourceIds: sources.map((s) => s.answerId),
        status: "PENDING",
      },
    });

    return { created: true };
  } catch (error) {
    console.error(
      `[draft] generation failed for doubt ${doubt.id}:`,
      (error as Error).message,
    );
    return { created: false, reason: (error as Error).message };
  }
};

export interface DraftRunResult {
  considered: number;
  created: number;
  skipped: number;
}

/** Cron entry point: draft for the oldest eligible unanswered doubts. */
export const runDraftGeneration = async (
  limit = 5,
): Promise<DraftRunResult> => {
  if (!AI_ENABLED) return { considered: 0, created: 0, skipped: 0 };

  const doubts = await findDoubtsNeedingDrafts(limit);
  let created = 0;

  for (const doubt of doubts) {
    const result = await generateDraftForDoubt(doubt);
    if (result.created) created++;
  }

  return {
    considered: doubts.length,
    created,
    skipped: doubts.length - created,
  };
};
