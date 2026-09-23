/**
 * Image-based doubt submission — CC-50.
 *
 * A student photographs a handwritten question, a textbook problem or a
 * diagram; a vision model turns it into a title, a description, a subject
 * guess and labels. Nothing here writes: the result is a DRAFT the student
 * edits and submits through the normal doubt form, exactly as CC-14 is
 * advisory for complaints.
 *
 * ## Why vision and not OCR
 *
 * The original plan was a Tesseract OCR phase. Classical OCR fails badly on
 * handwriting, and it cannot represent a diagram or a formula at all — it
 * emits a character stream, so a circuit sketch becomes noise and an integral
 * sign becomes `f`. A vision model reads the handwriting *and* understands
 * what is being asked in one call, which is both more accurate and less code.
 * The original image stays attached either way, so a reader can always check
 * the transcription against what the student actually wrote.
 *
 * See docs/specs/CC-50-image-doubts.md.
 */
import { AttachmentEntity, AttachmentStatus } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  STORAGE_ENABLED,
  VISION_ENABLED,
  VISION_MAX_IMAGE_BYTES,
} from "../../config/env.js";
import { describeImage, isVisionAvailable } from "../ai/vision/index.js";
import { downloadObject } from "../storage/supabaseStorage.js";
import { MAX_TAG_LENGTH, normalizeTag } from "../../utils/tags.js";

/**
 * What the vision path accepts.
 *
 * A subset of the CC-02 allow-list: PDFs are excluded because the vision API
 * takes an image, and "upload your PDF and we will read page one" is a
 * different feature with its own failure modes. HEIC is excluded for a less
 * obvious reason — Mistral rejects it, and iPhones send it by default, so this
 * is the one case where the storage layer accepts something this layer must
 * refuse with a message the student can act on.
 */
export const VISION_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Thrown for conditions the route turns into a 4xx rather than a 500. */
export class VisionExtractionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VisionExtractionError";
  }
}

export interface ExtractedDoubt {
  title: string;
  description: string;
  subject: string | null;
  labels: string[];
  /** The model's own read on whether the image was legible. */
  legible: boolean;
  /** Provenance, surfaced in the UI so nobody mistakes this for typed text. */
  model: string;
  provider: string;
}

/**
 * The instruction sent alongside the image.
 *
 * Three things it is doing deliberately:
 *
 *  - Asking for JSON only. The parser is defensive anyway, but a model that is
 *    told to produce prose will produce prose.
 *  - Forbidding the model from ANSWERING. Left unsaid, a vision model happily
 *    solves the equation it just read, and the student would post a doubt whose
 *    description already contains the answer — destroying the point of asking.
 *  - Making illegibility a first-class outcome. A blurred photo must come back
 *    as `legible: false`, not as a confident hallucination of a plausible
 *    question, because the second failure is invisible to the student.
 */
const INSTRUCTION = [
  "You are transcribing a student's academic question from a photograph.",
  "",
  "Reply with ONLY a JSON object, no prose and no code fence:",
  '{"title": string, "description": string, "subject": string|null,',
  ' "labels": string[], "legible": boolean}',
  "",
  "title: a one-line summary of what is being asked, at most 100 characters.",
  "description: the full question, transcribed faithfully. Preserve every",
  "  number, variable and unit exactly as written. Describe any diagram in",
  "  words so someone who cannot see the image can still answer.",
  "subject: the academic subject if it is obvious, otherwise null.",
  "labels: up to 5 short topic tags, lowercase.",
  "legible: false if the image is too blurred, dark or cropped to read, or if",
  "  it does not contain a question at all.",
  "",
  "DO NOT ANSWER THE QUESTION. Transcribe it only. The student is asking their",
  "peers, and an answer here would replace the question they meant to post.",
  "",
  "If legible is false, set title and description to empty strings rather than",
  "guessing at what the image might have said.",
].join("\n");

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 5000;
const MAX_LABELS = 5;

/**
 * Pull the JSON out of the reply.
 *
 * Same posture as CC-14's parser: everything unrecognised degrades to a safe
 * default rather than being passed through. A wrong-but-plausible field costs
 * the student more than an empty one, because an empty field is obviously
 * theirs to fill and a wrong one looks finished.
 */
export const parseVisionJson = (
  content: string,
): Omit<ExtractedDoubt, "model" | "provider"> | null => {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(content.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }

  // Anything other than an explicit `false` counts as legible. A model that
  // omits the field has not claimed the image was unreadable, and defaulting
  // the other way would discard good transcriptions on a missing key.
  const legible = payload.legible !== false;

  const title =
    typeof payload.title === "string" ? payload.title.trim().slice(0, MAX_TITLE) : "";
  const description =
    typeof payload.description === "string"
      ? payload.description.trim().slice(0, MAX_DESCRIPTION)
      : "";

  const subject =
    typeof payload.subject === "string" && payload.subject.trim()
      ? payload.subject.trim().slice(0, 100)
      : null;

  // Routed through CC-20's normaliser so an image-derived tag is identical to
  // a typed one. Skipping it would quietly create a parallel tag vocabulary
  // that filtering never matches.
  //
  // `normalizeTag` rather than `prepareTags`: prepareTags THROWS on an
  // over-long tag, which is right for a student who typed it and wrong for a
  // model that invented it. A suggestion the student never asked for must
  // never be able to fail their request — over-long tags are dropped.
  const labels = Array.isArray(payload.labels)
    ? [
        ...new Set(
          payload.labels
            .filter(
              (l): l is string =>
                typeof l === "string" && l.trim().length <= MAX_TAG_LENGTH,
            )
            .map((l) => normalizeTag(l))
            .filter((l): l is string => l !== null),
        ),
      ].slice(0, MAX_LABELS)
    : [];

  // A "legible" result with nothing in it is not legible, whatever the model
  // said about itself.
  if (legible && !description) {
    return { title: "", description: "", subject: null, labels: [], legible: false };
  }

  return { title, description, subject, labels, legible };
};

export interface ExtractInput {
  attachmentId: string;
  /** The caller. Only the uploader may extract from their own image. */
  userId: string;
}

/**
 * Turn an uploaded image into a doubt draft.
 *
 * The attachment must already exist via CC-02 — this never accepts raw bytes,
 * which keeps the size cap, the MIME allow-list and the ownership check in one
 * place instead of two.
 */
export const extractDoubtFromImage = async (
  input: ExtractInput,
): Promise<ExtractedDoubt> => {
  if (!STORAGE_ENABLED) {
    throw new VisionExtractionError(
      "File storage is not configured on this deployment.",
      503,
    );
  }

  if (!VISION_ENABLED || !isVisionAvailable()) {
    throw new VisionExtractionError(
      "Reading questions from images is not available on this deployment.",
      503,
    );
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: input.attachmentId },
  });

  if (!attachment) {
    throw new VisionExtractionError("Image not found.", 404);
  }

  // Ownership, not visibility. Extraction spends a metered third-party call,
  // so it is gated on "you uploaded this", which is stricter than the read
  // rule for doubt attachments (any authenticated member can view those).
  if (attachment.uploadedById !== input.userId) {
    throw new VisionExtractionError(
      "You can only read questions from images you uploaded.",
      403,
    );
  }

  // PENDING is the expected state: the student uploads, we read the image, and
  // only then do they submit the form that confirms it. ATTACHED is allowed
  // too, so "re-read this image" works on a doubt that already exists.
  if (
    attachment.status !== AttachmentStatus.PENDING &&
    attachment.status !== AttachmentStatus.ATTACHED
  ) {
    throw new VisionExtractionError("This image is not available.", 409);
  }

  if (attachment.entityType !== AttachmentEntity.DOUBT) {
    throw new VisionExtractionError(
      "This image was not uploaded as a doubt attachment.",
      400,
    );
  }

  if (!VISION_ALLOWED_MIME.has(attachment.mimeType)) {
    throw new VisionExtractionError(
      `Questions can only be read from JPG, PNG or WebP images. ` +
        `Convert the file and try again.`,
      400,
    );
  }

  if (attachment.sizeBytes > VISION_MAX_IMAGE_BYTES) {
    throw new VisionExtractionError(
      `Image is too large to read. Maximum is ` +
        `${Math.floor(VISION_MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
      400,
    );
  }

  const bytes = await downloadObject(attachment.storagePath).catch(() => null);

  if (!bytes) {
    // The row exists but the object does not: an upload that was signed and
    // abandoned before the PUT landed.
    throw new VisionExtractionError(
      "That upload did not finish. Please try again.",
      400,
    );
  }

  const result = await describeImage(
    { data: bytes, mimeType: attachment.mimeType },
    INSTRUCTION,
  );

  if (!result) {
    throw new VisionExtractionError(
      "Could not read the image just now. Please type your question instead.",
      503,
    );
  }

  const parsed = parseVisionJson(result.content);

  if (!parsed) {
    throw new VisionExtractionError(
      "Could not read the image just now. Please type your question instead.",
      503,
    );
  }

  if (!parsed.legible) {
    throw new VisionExtractionError(
      "That image could not be read. Try better lighting, or type the " +
        "question out instead.",
      422,
    );
  }

  return { ...parsed, model: result.model, provider: result.provider };
};

/** Exposed for the test suite, which exercises the parser directly. */
export const __testing = { INSTRUCTION, parseVisionJson };
