/**
 * CC-50: reading a doubt out of an image.
 *
 * Two things carry the weight here.
 *
 * The first is that a bad transcription must fail LOUDLY. A model that cannot
 * read a photo will happily invent a plausible physics question instead, and
 * that failure is invisible to the student — they see a filled-in form and
 * assume it is theirs. So `legible: false`, an empty description and
 * unparseable output all have to reach the caller as errors, never as a draft.
 *
 * The second is that the model must not ANSWER. Left unconstrained a vision
 * model solves the equation it just read, and the student posts a doubt whose
 * description already contains the answer.
 *
 * Supabase and Mistral are both mocked at their module boundary — nothing here
 * touches the network.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { attachment: { findUnique: vi.fn() } },
}));

const storage = vi.hoisted(() => ({ downloadObject: vi.fn() }));

const vision = vi.hoisted(() => ({
  describeImage: vi.fn(),
  isVisionAvailable: vi.fn(() => true),
}));

const env = vi.hoisted(() => ({
  STORAGE_ENABLED: true,
  VISION_ENABLED: true,
  VISION_MAX_IMAGE_BYTES: 4 * 1024 * 1024,
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../services/storage/supabaseStorage.js", () => storage);
vi.mock("../../services/ai/vision/index.js", () => vision);
vi.mock("../../config/env.js", () => env);

import {
  VisionExtractionError,
  __testing,
  extractDoubtFromImage,
} from "../../services/vision/extractDoubt.js";

const { parseVisionJson, INSTRUCTION } = __testing;

const UPLOADER = "user-1";

/** A PENDING doubt image owned by UPLOADER — the normal case. */
const attachment = (overrides: Record<string, unknown> = {}) => ({
  id: "att-1",
  storagePath: "DOUBT/pending/att-1.jpg",
  bucket: "b",
  mimeType: "image/jpeg",
  sizeBytes: 100_000,
  originalName: "q.jpg",
  status: "PENDING",
  entityType: "DOUBT",
  entityId: null,
  uploadedById: UPLOADER,
  ...overrides,
});

const goodReply = {
  title: "Solve for x",
  description: "Solve 3x + 2 = 20, showing each step.",
  subject: "Mathematics",
  labels: ["Algebra", "linear equations"],
  legible: true,
};

const modelReturns = (payload: unknown) =>
  vision.describeImage.mockResolvedValue({
    content: typeof payload === "string" ? payload : JSON.stringify(payload),
    provider: "mistral-vision",
    model: "mistral-medium-latest",
  });

/** Run the extractor and return the error it threw. */
const failure = async (): Promise<VisionExtractionError> => {
  try {
    await extractDoubtFromImage({ attachmentId: "att-1", userId: UPLOADER });
  } catch (error) {
    return error as VisionExtractionError;
  }
  throw new Error("expected extraction to fail, but it succeeded");
};

beforeEach(() => {
  vi.clearAllMocks();
  env.STORAGE_ENABLED = true;
  env.VISION_ENABLED = true;
  env.VISION_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
  vision.isVisionAvailable.mockReturnValue(true);
  db.prisma.attachment.findUnique.mockResolvedValue(attachment());
  storage.downloadObject.mockResolvedValue(Buffer.from("jpeg-bytes"));
  modelReturns(goodReply);
});

describe("the instruction", () => {
  /**
   * The single most important line in the prompt. Without it the model answers
   * the question, and the student posts a doubt that already contains its own
   * answer — which defeats the entire point of asking a community.
   */
  it("forbids answering the question", () => {
    expect(INSTRUCTION).toMatch(/DO NOT ANSWER THE QUESTION/);
  });

  it("makes illegibility an explicit outcome rather than a guess", () => {
    expect(INSTRUCTION).toMatch(/legible/);
    expect(INSTRUCTION).toMatch(/rather than\s+guessing/);
  });

  it("asks for JSON with no code fence", () => {
    expect(INSTRUCTION).toMatch(/ONLY a JSON object/);
  });
});

describe("parseVisionJson", () => {
  it("reads a clean object", () => {
    const parsed = parseVisionJson(JSON.stringify(goodReply));
    expect(parsed?.title).toBe("Solve for x");
    expect(parsed?.legible).toBe(true);
  });

  it("tolerates a code fence and surrounding prose", () => {
    const wrapped = `Sure! Here is the JSON:\n\`\`\`json\n${JSON.stringify(goodReply)}\n\`\`\`\nHope that helps.`;
    expect(parseVisionJson(wrapped)?.title).toBe("Solve for x");
  });

  it("returns null on unparseable output rather than a half-filled draft", () => {
    expect(parseVisionJson("I cannot read this image.")).toBeNull();
    expect(parseVisionJson("{ not json at all")).toBeNull();
  });

  /**
   * CC-20 normalisation. An image-derived tag must be byte-identical to a typed
   * one, or filtering silently builds a second vocabulary it never matches.
   */
  it("normalises labels the same way typed tags are normalised", () => {
    expect(parseVisionJson(JSON.stringify(goodReply))?.labels).toEqual([
      "algebra",
      "linear-equations",
    ]);
  });

  it("drops an over-long tag instead of failing the whole request", () => {
    const parsed = parseVisionJson(
      JSON.stringify({ ...goodReply, labels: ["ok", "x".repeat(200)] }),
    );
    expect(parsed?.labels).toEqual(["ok"]);
  });

  it("deduplicates labels that normalise to the same tag", () => {
    const parsed = parseVisionJson(
      JSON.stringify({ ...goodReply, labels: ["Algebra", "algebra", "ALGEBRA"] }),
    );
    expect(parsed?.labels).toEqual(["algebra"]);
  });

  it("caps labels at five", () => {
    const parsed = parseVisionJson(
      JSON.stringify({ ...goodReply, labels: ["a", "b", "c", "d", "e", "f", "g"] }),
    );
    expect(parsed?.labels).toHaveLength(5);
  });

  it("treats a missing legible flag as legible", () => {
    const { legible: _omitted, ...withoutFlag } = goodReply;
    expect(parseVisionJson(JSON.stringify(withoutFlag))?.legible).toBe(true);
  });

  /**
   * The subtle one. A model that reports success but returns nothing has not
   * read the image, whatever it claimed about itself — trusting the flag over
   * the content would hand the student a blank form labelled as a transcription.
   */
  it("overrides a legible:true claim when the description is empty", () => {
    const parsed = parseVisionJson(
      JSON.stringify({ ...goodReply, description: "", legible: true }),
    );
    expect(parsed?.legible).toBe(false);
  });

  it("truncates an over-long title rather than rejecting it", () => {
    const parsed = parseVisionJson(
      JSON.stringify({ ...goodReply, title: "T".repeat(500) }),
    );
    expect(parsed?.title.length).toBe(100);
  });

  it("coerces a non-string subject to null", () => {
    expect(
      parseVisionJson(JSON.stringify({ ...goodReply, subject: 42 }))?.subject,
    ).toBeNull();
  });
});

describe("extractDoubtFromImage", () => {
  it("returns a draft with provenance attached", async () => {
    const draft = await extractDoubtFromImage({
      attachmentId: "att-1",
      userId: UPLOADER,
    });

    expect(draft.title).toBe("Solve for x");
    expect(draft.subject).toBe("Mathematics");
    expect(draft.model).toBe("mistral-medium-latest");
    expect(draft.provider).toBe("mistral-vision");
  });

  it("sends the real bytes and the declared MIME type to the model", async () => {
    await extractDoubtFromImage({ attachmentId: "att-1", userId: UPLOADER });

    const [image, instruction] = vision.describeImage.mock.calls[0] as [
      { data: Buffer; mimeType: string },
      string,
    ];
    expect(image.data.toString()).toBe("jpeg-bytes");
    expect(image.mimeType).toBe("image/jpeg");
    expect(instruction).toBe(INSTRUCTION);
  });

  it("404s when the attachment does not exist", async () => {
    db.prisma.attachment.findUnique.mockResolvedValue(null);
    expect((await failure()).status).toBe(404);
  });

  /**
   * Stricter than the read rule for doubt attachments, which any authenticated
   * member may view. Extraction spends a metered third-party call, so it is
   * gated on having uploaded the image rather than on being able to see it.
   */
  it("403s for someone else's image, even though doubts are public", async () => {
    db.prisma.attachment.findUnique.mockResolvedValue(
      attachment({ uploadedById: "someone-else" }),
    );
    expect((await failure()).status).toBe(403);
    expect(vision.describeImage).not.toHaveBeenCalled();
  });

  it("400s on an image uploaded for a different kind of record", async () => {
    db.prisma.attachment.findUnique.mockResolvedValue(
      attachment({ entityType: "COMPLAINT" }),
    );
    expect((await failure()).status).toBe(400);
  });

  /**
   * HEIC is accepted by CC-02 because it is the iPhone default, but the vision
   * API rejects it — so this is the one place the storage allow-list and the
   * vision allow-list deliberately disagree, and the student needs to be told
   * which one bit them.
   */
  it.each(["image/heic", "application/pdf"])("400s on %s", async (mimeType) => {
    db.prisma.attachment.findUnique.mockResolvedValue(attachment({ mimeType }));
    const error = await failure();
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/JPG, PNG or WebP/);
    expect(vision.describeImage).not.toHaveBeenCalled();
  });

  it("400s on an image past the vision size cap before downloading it", async () => {
    db.prisma.attachment.findUnique.mockResolvedValue(
      attachment({ sizeBytes: 9_000_000 }),
    );
    expect((await failure()).status).toBe(400);
    expect(storage.downloadObject).not.toHaveBeenCalled();
  });

  it("400s when the row exists but the object never landed", async () => {
    storage.downloadObject.mockRejectedValue(new Error("not found"));
    expect((await failure()).status).toBe(400);
  });

  it("422s on an illegible image", async () => {
    modelReturns({ ...goodReply, legible: false, description: "" });
    const error = await failure();
    expect(error.status).toBe(422);
    expect(error.message).toMatch(/could not be read/);
  });

  it("503s when the model reply cannot be parsed", async () => {
    modelReturns("the image shows a cat");
    expect((await failure()).status).toBe(503);
  });

  it("503s when the provider is unavailable", async () => {
    vision.describeImage.mockResolvedValue(null);
    expect((await failure()).status).toBe(503);
  });

  it("503s with vision switched off, without touching the database", async () => {
    env.VISION_ENABLED = false;
    const error = await failure();
    expect(error.status).toBe(503);
    expect(db.prisma.attachment.findUnique).not.toHaveBeenCalled();
  });

  /**
   * Storage off is checked before vision: with no bucket the Attachment table
   * may not even be migrated, so the query would 500 rather than 503.
   */
  it("503s with storage switched off, without touching the database", async () => {
    env.STORAGE_ENABLED = false;
    const error = await failure();
    expect(error.status).toBe(503);
    expect(db.prisma.attachment.findUnique).not.toHaveBeenCalled();
  });

  it("allows re-reading an image already attached to a doubt", async () => {
    db.prisma.attachment.findUnique.mockResolvedValue(
      attachment({ status: "ATTACHED", entityId: "doubt-1" }),
    );
    await expect(
      extractDoubtFromImage({ attachmentId: "att-1", userId: UPLOADER }),
    ).resolves.toMatchObject({ title: "Solve for x" });
  });
});
