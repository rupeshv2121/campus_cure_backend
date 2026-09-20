/**
 * CC-14: complaint intake parsing.
 *
 * The guarantee that matters most is location validation: a hallucinated room
 * would route a real fault to a room that does not exist.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({ completeWithFallback: vi.fn() }));
const env = vi.hoisted(() => ({ AI_ENABLED: true, INTAKE_PREFER_MODEL: false }));

vi.mock("../../services/ai/chat/index.js", () => chat);
vi.mock("../../config/env.js", () => env);

import {
  extractCategory,
  extractLocation,
  extractPriority,
  parseWithRules,
  resolveLocation,
} from "../../services/intake/rules.js";
import { parseComplaintText } from "../../services/intake/parseComplaint.js";

const modelReplies = (payload: unknown) =>
  chat.completeWithFallback.mockResolvedValue({
    content: JSON.stringify(payload),
    provider: "groq",
    model: "m",
  });

beforeEach(() => {
  vi.clearAllMocks();
  env.AI_ENABLED = true;
  env.INTAKE_PREFER_MODEL = false;
});

describe("rules", () => {
  it.each([
    ["The projector will not turn on", "SMART_BOARD"],
    ["wifi is down", "NETWORK"],
    ["ceiling fan not spinning", "FAN"],
    ["tube lights not glowing", "LIGHT"],
    ["broken chair", "SEATING"],
    ["the drawer is jammed", "FURNITURE"],
  ])("classifies %s", (text, expected) => {
    expect(extractCategory(text)).toBe(expected);
  });

  it("returns null when nothing matches, so the model gets a turn", () => {
    expect(extractCategory("something is wrong in here")).toBeNull();
  });

  /**
   * Direction matters and is easy to get backwards: the form the student sees
   * is 1 Low .. 5 Critical, so an inverted scale would file "sparking socket,
   * dangerous" as Low.
   */
  it.each([
    ["urgent, cannot take the lecture", 5],
    ["sparking socket, dangerous", 5],
    ["the fan is not working", 3],
    ["minor cosmetic issue", 1],
  ])("infers priority from %s", (text, expected) => {
    expect(extractPriority(text)).toBe(expected);
  });

  describe("location", () => {
    it.each(["ML03", "ML 03", "ML-03", "ml03"])(
      "extracts a room written as %s",
      (written) => {
        expect(extractLocation(`projector in ${written} broken`)).toEqual({
          block: "ML",
          classroomNumber: "ML03",
        });
      },
    );

    it("derives the block from the room code alone", () => {
      expect(resolveLocation(null, "NL22")).toEqual({
        block: "NL",
        classroomNumber: "NL22",
      });
    });

    /** The guarantee: an unknown room is dropped, never returned. */
    it("rejects a room that does not exist", () => {
      expect(resolveLocation(null, "ZZ99")).toEqual({
        block: null,
        classroomNumber: null,
      });
      expect(extractLocation("projector in ZZ99 is dead")).toEqual({
        block: null,
        classroomNumber: null,
      });
    });

    it("keeps a real block when only the room is unknown", () => {
      expect(resolveLocation("ML", "ZZ99")).toEqual({
        block: "ML",
        classroomNumber: null,
      });
    });

    it("recognises a block named without a room", () => {
      expect(extractLocation("the whiteboard in NL Block is damaged")).toEqual({
        block: "NL",
        classroomNumber: null,
      });
    });

    it("does not mistake an ordinary number for a room", () => {
      expect(parseWithRules("I have 3 complaints about the fan").classroomNumber)
        .toBeNull();
    });
  });
});

describe("parseComplaintText", () => {
  it("answers from rules without calling the model", async () => {
    const result = await parseComplaintText("The projector in ML03 is dead");

    expect(result.source).toBe("rules");
    expect(result.category).toBe("SMART_BOARD");
    expect(chat.completeWithFallback).not.toHaveBeenCalled();
  });

  it("falls through to the model when rules find no category", async () => {
    modelReplies({ category: "FAN", priority: 2, block: "NL", room: "NL22" });

    const result = await parseComplaintText(
      "the thing on the ceiling in NL22 has stopped spinning",
    );

    expect(chat.completeWithFallback).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ category: "FAN", source: "model" });
  });

  it("consults the model even on a rules hit when configured to", async () => {
    env.INTAKE_PREFER_MODEL = true;
    modelReplies({ category: "OTHER", priority: 2, block: null, room: null });

    const result = await parseComplaintText("wasp nest outside the window");

    expect(chat.completeWithFallback).toHaveBeenCalledOnce();
    expect(result.category).toBe("OTHER");
  });

  describe("the model cannot invent a location", () => {
    it("drops a room that is not on the known list", async () => {
      modelReplies({ category: "FAN", priority: 2, block: "XX", room: "XX99" });

      const result = await parseComplaintText("something is broken in here");

      expect(result.classroomNumber).toBeNull();
      expect(result.block).toBeNull();
    });

    it("keeps the rules location in preference to the model's", async () => {
      modelReplies({ category: "FAN", priority: 2, block: "NL", room: "NL26" });

      // The text names ML03; the model claims NL26.
      const result = await parseComplaintText(
        "something odd is happening in ML03 today",
      );

      expect(result.classroomNumber).toBe("ML03");
    });
  });

  describe("malformed model output", () => {
    it("ignores an invalid category", async () => {
      modelReplies({ category: "PLUMBING", priority: 2 });
      const result = await parseComplaintText("something is broken in here");
      expect(result.source).toBe("rules");
    });

    it("survives non-JSON", async () => {
      chat.completeWithFallback.mockResolvedValue({
        content: "I think it is a fan problem!",
        provider: "groq",
        model: "m",
      });
      await expect(
        parseComplaintText("something is broken in here"),
      ).resolves.toMatchObject({ source: "rules" });
    });

    it("extracts JSON from inside a code fence", async () => {
      chat.completeWithFallback.mockResolvedValue({
        content: '```json\n{"category":"FAN","priority":2}\n```',
        provider: "groq",
        model: "m",
      });
      const result = await parseComplaintText("something is broken in here");
      expect(result.category).toBe("FAN");
    });

    it("rejects an out-of-range priority", async () => {
      modelReplies({ category: "FAN", priority: 99 });
      const result = await parseComplaintText("something is broken in here");
      expect([1, 2, 3, 4, 5]).toContain(result.priority);
    });

    it("accepts the full 1-5 range the form uses", async () => {
      modelReplies({ category: "FAN", priority: 4 });
      const result = await parseComplaintText("something is broken in here");
      expect(result.priority).toBe(4);
    });
  });

  describe("degradation", () => {
    it("returns rules only when AI is disabled", async () => {
      env.AI_ENABLED = false;
      const result = await parseComplaintText("something is broken in here");
      expect(result.source).toBe("rules");
      expect(chat.completeWithFallback).not.toHaveBeenCalled();
    });

    it("returns rules when the provider fails", async () => {
      chat.completeWithFallback.mockRejectedValue(new Error("503"));
      await expect(
        parseComplaintText("something is broken in here"),
      ).resolves.toMatchObject({ source: "rules" });
    });

    it("returns nothing for text that is too short", async () => {
      const result = await parseComplaintText("hi");
      expect(result.source).toBe("none");
      expect(chat.completeWithFallback).not.toHaveBeenCalled();
    });
  });
});
