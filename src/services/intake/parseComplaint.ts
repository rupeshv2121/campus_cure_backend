/**
 * Complaint intake: free text to structured fields — CC-14.
 *
 * Rules run first and most complaints never get past them. The model is called
 * only when the rules cannot name a category, which keeps the common case free,
 * deterministic and instant.
 *
 * Nothing here writes. The result is a suggestion the student confirms, never a
 * silent categorisation — see docs/specs/CC-14-complaint-intake.md.
 */
import { AI_ENABLED, INTAKE_PREFER_MODEL } from "../../config/env.js";
import { completeWithFallback } from "../ai/chat/index.js";
import {
  KNOWN_BLOCKS,
  KNOWN_ROOMS,
  extractPriority,
  parseWithRules,
  resolveLocation,
  type Category,
  type ParsedComplaint,
  type Priority,
} from "./rules.js";

export type ParseSource = "rules" | "model" | "none";

export interface ComplaintParseResult extends ParsedComplaint {
  /** Which path produced the category, so the UI and the harness can tell. */
  source: ParseSource;
}

const VALID_CATEGORIES: Category[] = [
  "FAN",
  "LIGHT",
  "SMART_BOARD",
  "NETWORK",
  "SEATING",
  "FURNITURE",
  "OTHER",
];

export const MIN_TEXT_LENGTH = 10;

const systemPrompt = (): string =>
  [
    "Extract structured fields from a student's campus maintenance complaint.",
    "",
    "Reply with ONLY a JSON object, no prose and no code fence:",
    '{"category": string, "priority": 1|2|3|4|5, "block": string|null, "room": string|null}',
    "",
    `category must be exactly one of: ${VALID_CATEGORIES.join(", ")}`,
    "  SMART_BOARD covers projectors, displays and interactive boards.",
    "  NETWORK covers wifi, internet and connectivity.",
    "  SEATING covers chairs and benches; FURNITURE covers desks, doors,",
    "  windows, cupboards and whiteboards.",
    "  Use OTHER only when nothing else fits.",
    "",
    "priority: 1 Low, 2 Minor, 3 Medium, 4 High, 5 Critical.",
    "  5 for anything unsafe or blocking a lecture; 1 for cosmetic issues.",
    "",
    `block must be one of: ${KNOWN_BLOCKS.join(", ")} — or null.`,
    "room must be a room code that appears in the complaint — or null.",
    "NEVER invent a room or block that is not stated in the text.",
  ].join("\n");

/**
 * Parse the model's reply.
 *
 * Defensive throughout: the model may wrap JSON in a fence, add prose, or
 * return a category that does not exist. Anything unrecognised becomes null
 * rather than being passed through — a wrong-but-plausible field is worse than
 * an empty one the student fills in.
 */
const parseModelJson = (content: string): Partial<ParsedComplaint> => {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return {};

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }

  const rawCategory =
    typeof payload.category === "string" ? payload.category.toUpperCase() : null;
  const category =
    rawCategory && (VALID_CATEGORIES as string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : null;

  const rawPriority = Number(payload.priority);
  const priority =
    Number.isInteger(rawPriority) && rawPriority >= 1 && rawPriority <= 5
      ? (rawPriority as Priority)
      : null;

  // Validated against the known list — a hallucinated room would send a real
  // fault to a room that does not exist.
  const location = resolveLocation(
    typeof payload.block === "string" ? payload.block : null,
    typeof payload.room === "string" ? payload.room : null,
  );

  return { category, priority, ...location };
};

/**
 * Parse free text into complaint fields.
 *
 * Never throws. With AI disabled, no provider, or a provider failure, the rules
 * result is returned — the student always has something, and always has the
 * full form behind it.
 */
export const parseComplaintText = async (
  text: string,
): Promise<ComplaintParseResult> => {
  const trimmed = text.trim();

  if (trimmed.length < MIN_TEXT_LENGTH) {
    return {
      category: null,
      priority: null,
      block: null,
      classroomNumber: null,
      source: "none",
    };
  }

  const rules = parseWithRules(trimmed);

  // A rules hit normally ends it: free, instant and reproducible.
  //
  // The measured cost is that a rules FALSE POSITIVE never reaches the model —
  // "a wasp nest outside the window" is classified as FURNITURE. That is worth
  // 10 points of accuracy on the eval set, which INTAKE_PREFER_MODEL trades
  // back for quota when it is set.
  if (rules.category && !INTAKE_PREFER_MODEL) {
    return { ...rules, source: "rules" };
  }

  if (!AI_ENABLED) return { ...rules, source: "rules" };

  const completion = await completeWithFallback(
    [
      { role: "system", content: systemPrompt() },
      { role: "user", content: trimmed },
    ],
    // Generous: gpt-oss spends part of the budget reasoning before emitting
    // a single character, and a truncated reply is unparseable JSON.
    { maxTokens: 800, temperature: 0 },
  ).catch(() => null);

  if (!completion) return { ...rules, source: "rules" };

  const fromModel = parseModelJson(completion.content);

  if (!fromModel.category) {
    // The model added nothing usable; the rules result still stands.
    return { ...rules, source: "rules" };
  }

  return {
    category: fromModel.category,
    // Rules win on location when they found one: they only ever return a room
    // that exists, and they read the same text.
    block: rules.block ?? fromModel.block ?? null,
    classroomNumber: rules.classroomNumber ?? fromModel.classroomNumber ?? null,
    priority: fromModel.priority ?? extractPriority(trimmed),
    source: "model",
  };
};

/** Exposed for the evaluation harness, which compares the paths directly. */
export const __testing = { parseModelJson, systemPrompt, KNOWN_ROOMS };
