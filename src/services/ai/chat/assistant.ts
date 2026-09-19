/**
 * The chatbot loop — CC-15.
 *
 * Sends the student's question with tool definitions, executes any tools the
 * model asks for **in our code as the authenticated user**, feeds the results
 * back, and returns the final answer.
 *
 * Tools are built per-request with the caller's id closed over, so the model
 * has no way to name another user. See `tools.ts` for the security model.
 */
import { AI_ENABLED } from "../../../config/env.js";
import { getChatProviders } from "./index.js";
import { buildStudentTools, type ToolSet } from "./tools.js";
import type { ChatMessage } from "./types.js";

/**
 * Hard cap on tool rounds.
 *
 * Not a nicety: without it a confused model can request tools indefinitely and
 * spend the free-tier quota in a single conversation.
 */
export const MAX_TOOL_ROUNDS = 3;

export const MAX_MESSAGE_LENGTH = 1000;
/** Turns of prior conversation replayed as context. */
export const MAX_HISTORY_TURNS = 6;

const SYSTEM_PROMPT = [
  "You are CampusCure's assistant, helping a student with questions about their",
  "own complaints, doubts, answers and notifications on this campus platform.",
  "",
  "How to behave:",
  "- Use the tools to look things up. Never guess at data, never invent a",
  "  complaint, status, date or name.",
  "- If a tool returns nothing, say plainly that you found nothing. Do not",
  "  fabricate a plausible-sounding record.",
  "- Be brief and concrete. Give statuses, dates and titles as they are.",
  "- You can only see this student's own records. If asked about anyone else's",
  "  data, say you can only access their own.",
  "- For academic questions ('explain binary search'), do not attempt to teach.",
  "  Suggest they post it as a doubt so faculty can answer, and offer to search",
  "  whether it has been asked already.",
  "- You cannot perform actions — no filing, editing or deleting. Say so and",
  "  point them to the right page.",
].join("\n");

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResult {
  reply: string;
  /** Tools actually executed, in order. Surfaced so the UI can show its work. */
  toolsUsed: string[];
  degraded: boolean;
}

const unavailable = (reply: string): AssistantResult => ({
  reply,
  toolsUsed: [],
  degraded: true,
});

/** Parse model-supplied arguments defensively — they are not trusted input. */
const parseArgs = (json: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(json || "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const runTool = async (
  toolSet: ToolSet,
  name: string,
  argumentsJson: string,
): Promise<string> => {
  const handler = toolSet.handlers[name];

  // A model can hallucinate a tool name. Report it back rather than throwing,
  // so the model can recover instead of the whole turn failing.
  if (!handler) {
    return JSON.stringify({ error: `No such tool: ${name}` });
  }

  try {
    const result = await handler(parseArgs(argumentsJson));
    // Empty results are passed back explicitly. Omitting them invites the model
    // to fill the silence with something invented.
    return JSON.stringify(
      Array.isArray(result) && result.length === 0
        ? { results: [], note: "No matching records found." }
        : result,
    );
  } catch (error) {
    console.error(`[chat] tool ${name} failed:`, (error as Error).message);
    return JSON.stringify({ error: "That lookup failed." });
  }
};

/**
 * Answer one student message.
 *
 * `userId` must come from the verified token. Nothing in `message` or `history`
 * can influence which user's data is reachable.
 */
export const askAssistant = async (
  userId: string,
  message: string,
  history: AssistantTurn[] = [],
): Promise<AssistantResult> => {
  if (!AI_ENABLED) {
    return unavailable("The assistant is switched off at the moment.");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return unavailable("Please type a question.");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return unavailable(
      `That message is too long — please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }

  const provider = getChatProviders()[0];
  if (!provider) {
    return unavailable("The assistant is not available right now.");
  }

  const toolSet = buildStudentTools(userId);
  const toolsUsed: string[] = [];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_MESSAGE_LENGTH),
    })),
    { role: "user", content: trimmed },
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await provider.completeWithTools(
        messages,
        toolSet.definitions,
      );

      if (completion.toolCalls.length === 0) {
        return {
          reply:
            completion.content ||
            "I could not work that out — could you rephrase?",
          toolsUsed,
          degraded: false,
        };
      }

      // Replay the assistant's tool request verbatim; the API requires the
      // tool results to follow the exact message that asked for them.
      messages.push(completion.rawMessage as ChatMessage);

      for (const call of completion.toolCalls) {
        toolsUsed.push(call.name);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: await runTool(toolSet, call.name, call.argumentsJson),
        });
      }
    }

    // Round cap hit. Ask for a final answer with no tools available, so the
    // model must conclude rather than request more.
    const final = await provider.completeWithTools(messages, []);
    return {
      reply:
        final.content ||
        "I found some information but could not summarise it — please try the relevant page.",
      toolsUsed,
      degraded: false,
    };
  } catch (error) {
    console.error("[chat] assistant failed:", (error as Error).message);
    return unavailable(
      "The assistant is having trouble right now. Please try again shortly.",
    );
  }
};
