/**
 * CC-50: vision provider selection and failover.
 *
 * Groq is primary, Mistral the fallback. The providers themselves are covered
 * in `openaiCompatibleVision.test.ts`; this file checks only the ordering and
 * the null-not-throw contract `describeImage` gives its callers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  VISION_ENABLED: true,
  GROQ_VISION_API_KEY: "gsk-test" as string | undefined,
  GROQ_VISION_MODEL: "groq-vision-model",
  MISTRAL_API_KEY: "mk-test" as string | undefined,
  MISTRAL_VISION_MODEL: "mistral-vision-model",
}));

const describeCalls = vi.hoisted(() => [] as string[]);
const outcomes = vi.hoisted(() => new Map<string, () => Promise<string>>());

vi.mock("../../config/env.js", () => env);
vi.mock("../../services/ai/vision/openaiCompatibleVision.js", () => ({
  OpenAICompatibleVisionProvider: class {
    readonly name: string;
    readonly model: string;
    readonly imageUrlFormat: string;
    constructor(options: { name: string; model: string; imageUrlFormat: string }) {
      this.name = options.name;
      this.model = options.model;
      this.imageUrlFormat = options.imageUrlFormat;
    }
    describe() {
      describeCalls.push(this.name);
      return (outcomes.get(this.name) ?? (async () => "ok"))();
    }
  },
}));

const vision = await import("../../services/ai/vision/index.js");

const image = { data: Buffer.from("x"), mimeType: "image/png" };

beforeEach(() => {
  env.VISION_ENABLED = true;
  env.GROQ_VISION_API_KEY = "gsk-test";
  env.MISTRAL_API_KEY = "mk-test";
  describeCalls.length = 0;
  outcomes.clear();
  vision.resetVisionProvider();
});

describe("getVisionProviders", () => {
  it("orders Groq before Mistral, each with its own image_url shape", () => {
    const providers = vision.getVisionProviders() as unknown as Array<{
      name: string;
      imageUrlFormat: string;
    }>;
    expect(providers.map((p) => [p.name, p.imageUrlFormat])).toEqual([
      ["groq-vision", "object"],
      ["mistral-vision", "string"],
    ]);
  });

  it("is empty when the switch is off, whatever keys exist", () => {
    env.VISION_ENABLED = false;
    expect(vision.getVisionProviders()).toEqual([]);
    expect(vision.isVisionAvailable()).toBe(false);
  });

  it("runs on Groq alone", () => {
    env.MISTRAL_API_KEY = undefined;
    expect(vision.getVisionProviders().map((p) => p.name)).toEqual([
      "groq-vision",
    ]);
  });
});

describe("describeImage", () => {
  it("answers from Groq without touching Mistral", async () => {
    outcomes.set("groq-vision", async () => "from groq");

    await expect(vision.describeImage(image, "x")).resolves.toEqual({
      content: "from groq",
      provider: "groq-vision",
      model: "groq-vision-model",
    });
    expect(describeCalls).toEqual(["groq-vision"]);
  });

  it("falls back to Mistral when Groq fails", async () => {
    outcomes.set("groq-vision", async () => {
      throw new Error("429");
    });
    outcomes.set("mistral-vision", async () => "from mistral");

    const result = await vision.describeImage(image, "x");
    expect(result?.provider).toBe("mistral-vision");
    expect(describeCalls).toEqual(["groq-vision", "mistral-vision"]);
  });

  it("returns null, never throws, when every provider fails", async () => {
    const fail = async (): Promise<string> => {
      throw new Error("down");
    };
    outcomes.set("groq-vision", fail);
    outcomes.set("mistral-vision", fail);

    await expect(vision.describeImage(image, "x")).resolves.toBeNull();
  });
});
