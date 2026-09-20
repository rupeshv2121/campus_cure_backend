/**
 * Deterministic complaint parsing — CC-14.
 *
 * This runs BEFORE any model call, and most complaints never get past it.
 * "The fan in ML03 is not working" needs a keyword match, not a language model;
 * reaching for an LLM where `includes("fan")` suffices is what makes AI
 * projects look unserious.
 *
 * Everything here is pure, so the evaluation harness can run it without a
 * database or a provider.
 *
 * See docs/specs/CC-14-complaint-intake.md.
 */
import roomData from "../../data/block_classroom.json" with { type: "json" };

export type Category =
  | "FAN"
  | "LIGHT"
  | "SMART_BOARD"
  | "NETWORK"
  | "SEATING"
  | "FURNITURE"
  | "OTHER";

/**
 * Priority runs 1 (Low) to 5 (Critical), matching the form the student already
 * sees and the values already in the database. Getting this backwards would
 * file "sparking socket, dangerous" as Low.
 */
export type Priority = 1 | 2 | 3 | 4 | 5;

export interface ParsedComplaint {
  category: Category | null;
  priority: Priority | null;
  block: string | null;
  classroomNumber: string | null;
}

/**
 * Keyword patterns per category, most specific first.
 *
 * Order matters: "smart board" must be tested before "board", and "projector"
 * belongs to SMART_BOARD rather than being its own category because that is
 * how the existing data is categorised.
 */
const CATEGORY_PATTERNS: Array<[Category, RegExp]> = [
  ["SMART_BOARD", /\b(smart\s*board|projector|interactive\s*board|display|screen|hdmi)\b/i],
  ["NETWORK", /\b(wifi|wi-fi|internet|network|lan|ethernet|connectivity|router)\b/i],
  ["FAN", /\b(fan|ceiling\s*fan|air\s*circulation|regulator)\b/i],
  ["LIGHT", /\b(light|lights|lighting|tube\s*light|bulb|lamp|dark)\b/i],
  ["SEATING", /\b(chair|chairs|bench|benches|seat|seating|stool|desk\s*space)\b/i],
  ["FURNITURE", /\b(table|desk|drawer|cupboard|whiteboard|board\s*surface|door|window|furniture)\b/i],
];

/** Phrases that signal how badly this is blocking someone. */
const URGENT = /\b(urgent|emergency|immediately|cannot\s+(take|conduct|attend|hold)|unsafe|dangerous|exam|hazard|injur|smok|spark|shock)\b/i;
const LOW = /\b(minor|slightly|a\s+bit|cosmetic|whenever|no\s+rush|not\s+urgent|small\s+issue)\b/i;

/** Known blocks and rooms, so a room the model invents can be rejected. */
const ROOMS: Record<string, string[]> = Object.fromEntries(
  Object.entries(roomData as Record<string, { classrooms: string[] }>).map(
    ([block, value]) => [block, value.classrooms],
  ),
);

export const KNOWN_BLOCKS = Object.keys(ROOMS);
export const KNOWN_ROOMS = Object.values(ROOMS).flat();

/**
 * Resolve a block/room pair against the known list.
 *
 * Anything not on the list is dropped rather than returned. A hallucinated room
 * number would route a real fault to a room that does not exist, which is worse
 * than returning nothing and letting the student pick.
 */
export const resolveLocation = (
  block: string | null | undefined,
  room: string | null | undefined,
): { block: string | null; classroomNumber: string | null } => {
  const normalisedRoom = room?.trim().toUpperCase().replace(/\s+/g, "") ?? null;

  // The room alone identifies the block, since room codes are prefixed.
  if (normalisedRoom) {
    for (const [knownBlock, rooms] of Object.entries(ROOMS)) {
      if (rooms.includes(normalisedRoom)) {
        return { block: knownBlock, classroomNumber: normalisedRoom };
      }
    }
  }

  const normalisedBlock = block?.trim().toUpperCase() ?? null;
  if (normalisedBlock && KNOWN_BLOCKS.includes(normalisedBlock)) {
    // Block is real but the room is not; keep what is verifiable.
    return { block: normalisedBlock, classroomNumber: null };
  }

  return { block: null, classroomNumber: null };
};

/**
 * Find a room code mentioned anywhere in free text.
 *
 * Rather than building a pattern per known room — which got the spacing wrong
 * for "ML 05" and "ML-07" — this finds every token that LOOKS like a room code,
 * normalises it, and checks it against the known list. Validation stays in one
 * place, and new room formats need no new regex.
 */
const ROOM_TOKEN = /\b([A-Za-z]{1,3})[\s-]?(\d{1,3})\b/g;

export const extractLocation = (
  text: string,
): { block: string | null; classroomNumber: string | null } => {
  for (const match of text.matchAll(ROOM_TOKEN)) {
    const candidate = `${match[1]}${match[2]}`.toUpperCase();
    const resolved = resolveLocation(null, candidate);
    if (resolved.classroomNumber) return resolved;
  }

  // No room, but a block might still be named.
  for (const block of KNOWN_BLOCKS) {
    // Escaped for the RegExp constructor: inside a template literal a single
    // "\b" is a backspace character, not a word boundary.
    if (new RegExp(`\\b${block}\\s*block\\b`, "i").test(text)) {
      return { block, classroomNumber: null };
    }
  }

  return { block: null, classroomNumber: null };
};

export const extractCategory = (text: string): Category | null => {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
};

export const extractPriority = (text: string): Priority => {
  if (URGENT.test(text)) return 5; // Critical
  if (LOW.test(text)) return 1; // Low
  return 3; // Medium
};

/**
 * Parse with rules alone.
 *
 * `category === null` is the signal that the model is worth calling; everything
 * else is best-effort and safe to return as-is.
 */
export const parseWithRules = (text: string): ParsedComplaint => {
  const location = extractLocation(text);

  return {
    category: extractCategory(text),
    priority: extractPriority(text),
    block: location.block,
    classroomNumber: location.classroomNumber,
  };
};
