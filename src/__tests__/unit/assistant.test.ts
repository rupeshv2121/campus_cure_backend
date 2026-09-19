/**
 * CC-15: the chatbot loop.
 *
 * Covers termination, degradation, and the handling of empty tool results —
 * which is where a model would otherwise invent a plausible-looking record.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({ getChatProviders: vi.fn() }));
const tools = vi.hoisted(() => ({ buildStudentTools: vi.fn() }));

vi.mock("../../services/ai/chat/index.js", () => providers);
vi.mock("../../services/ai/chat/tools.js", () => tools);
vi.mock("../../config/env.js", () => ({ AI_ENABLED: true }));

import {
  askAssistant,
  MAX_MESSAGE_LENGTH,
  MAX_TOOL_ROUNDS,
} from "../../services/ai/chat/assistant.js";

const answer = (content: string) => ({
  content,
  toolCalls: [],
  rawMessage: { role: "assistant", content },
});

const wantsTool = (name: string, args = "{}") => ({
  content: "",
  toolCalls: [{ id: `call-${name}`, name, argumentsJson: args }],
  rawMessage: { role: "assistant", tool_calls: [{ id: `call-${name}` }] },
});

let completeWithTools: ReturnType<typeof vi.fn>;
let getMyComplaints: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  completeWithTools = vi.fn();
  providers.getChatProviders.mockReturnValue([
    { name: "groq", model: "m", completeWithTools },
  ]);
  getMyComplaints = vi.fn(async () => [{ title: "Broken fan", status: "RAISED" }]);
  tools.buildStudentTools.mockReturnValue({
    definitions: [
      {
        type: "function",
        function: {
          name: "getMyComplaints",
          description: "",
          parameters: { type: "object", properties: {} },
        },
      },
    ],
    handlers: { getMyComplaints },
  });
});

describe("askAssistant", () => {
  it("returns a direct answer when no tool is needed", async () => {
    completeWithTools.mockResolvedValue(answer("You have no complaints."));

    const result = await askAssistant("u1", "hello");

    expect(result.reply).toBe("You have no complaints.");
    expect(result.toolsUsed).toEqual([]);
    expect(result.degraded).toBe(false);
  });

  it("executes a requested tool and answers from the result", async () => {
    completeWithTools
      .mockResolvedValueOnce(wantsTool("getMyComplaints"))
      .mockResolvedValueOnce(answer("Your fan complaint is still open."));

    const result = await askAssistant("u1", "where is my complaint?");

    expect(getMyComplaints).toHaveBeenCalledOnce();
    expect(result.toolsUsed).toEqual(["getMyComplaints"]);
    expect(result.reply).toContain("fan complaint");
  });

  it("builds tools for the authenticated caller", async () => {
    completeWithTools.mockResolvedValue(answer("ok"));

    await askAssistant("the-real-user", "hi");

    expect(tools.buildStudentTools).toHaveBeenCalledWith("the-real-user");
  });

  /**
   * Without a cap, a confused model can request tools forever and spend the
   * whole free-tier quota in one conversation.
   */
  it("stops requesting tools at the round cap", async () => {
    completeWithTools.mockResolvedValue(wantsTool("getMyComplaints"));

    const result = await askAssistant("u1", "loop please");

    // MAX_TOOL_ROUNDS tool rounds, plus one final no-tools call.
    expect(completeWithTools).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(result.toolsUsed).toHaveLength(MAX_TOOL_ROUNDS);
    expect(result.reply).toBeTruthy();
  });

  it("offers no tools on the final call, so the model must conclude", async () => {
    completeWithTools.mockResolvedValue(wantsTool("getMyComplaints"));

    await askAssistant("u1", "loop");

    // Index access rather than .at(-1): the project targets the ES2020 lib.
    const calls = completeWithTools.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    expect(lastCall[1]).toEqual([]);
  });

  /**
   * An empty result must be stated, not omitted — silence is what invites a
   * model to fill the gap with an invented record.
   */
  it("passes empty tool results back explicitly", async () => {
    getMyComplaints.mockResolvedValue([]);
    completeWithTools
      .mockResolvedValueOnce(wantsTool("getMyComplaints"))
      .mockResolvedValueOnce(answer("You have no complaints."));

    await askAssistant("u1", "any complaints?");

    const messages = completeWithTools.mock.calls[1]![0];
    const toolMessage = messages.find((m: { role: string }) => m.role === "tool");
    expect(toolMessage.content).toContain("No matching records found");
  });

  it("reports an unknown tool back to the model instead of failing the turn", async () => {
    completeWithTools
      .mockResolvedValueOnce(wantsTool("getSomeoneElsesData"))
      .mockResolvedValueOnce(answer("I can only see your own records."));

    const result = await askAssistant("u1", "show me everything");

    expect(result.reply).toContain("your own records");
  });

  it("survives a tool that throws", async () => {
    getMyComplaints.mockRejectedValue(new Error("db down"));
    completeWithTools
      .mockResolvedValueOnce(wantsTool("getMyComplaints"))
      .mockResolvedValueOnce(answer("I could not look that up."));

    const result = await askAssistant("u1", "complaints?");

    expect(result.reply).toBeTruthy();
    expect(result.degraded).toBe(false);
  });

  it("tolerates malformed tool arguments", async () => {
    completeWithTools
      .mockResolvedValueOnce(wantsTool("getMyComplaints", "{not json"))
      .mockResolvedValueOnce(answer("Here they are."));

    await askAssistant("u1", "complaints?");

    expect(getMyComplaints).toHaveBeenCalledWith({});
  });

  describe("degradation", () => {
    it("degrades when no provider is configured", async () => {
      providers.getChatProviders.mockReturnValue([]);

      const result = await askAssistant("u1", "hi");

      expect(result.degraded).toBe(true);
      expect(result.reply).toMatch(/not available/i);
    });

    it("degrades when the provider throws", async () => {
      completeWithTools.mockRejectedValue(new Error("503"));

      const result = await askAssistant("u1", "hi");

      expect(result.degraded).toBe(true);
      expect(result.reply).toMatch(/trouble/i);
    });

    it("rejects an over-long message before calling any provider", async () => {
      const result = await askAssistant("u1", "x".repeat(MAX_MESSAGE_LENGTH + 1));

      expect(result.degraded).toBe(true);
      expect(completeWithTools).not.toHaveBeenCalled();
    });

    it("rejects an empty message before calling any provider", async () => {
      const result = await askAssistant("u1", "   ");

      expect(result.degraded).toBe(true);
      expect(completeWithTools).not.toHaveBeenCalled();
    });
  });
});
