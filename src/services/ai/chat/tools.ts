/**
 * Chatbot tools — CC-15.
 *
 * THE SECURITY MODEL, in one sentence: no tool takes an identity parameter, so
 * the model cannot express a request for another user's data.
 *
 * The obvious design — a `getComplaints(userId)` tool — is a data breach with a
 * friendly interface, because anything that can be described in a prompt can be
 * described by an attacker in a prompt. Here the authenticated user is closed
 * over when the handlers are built, and every query is scoped in code.
 *
 * A system prompt is NOT an access control mechanism. "Only show the user their
 * own data" is a suggestion to a text generator. These tools must hold even if
 * the model is entirely compromised by prompt injection.
 *
 * Everything here is also read-only. A misunderstood instruction that files a
 * complaint is far worse than one that answers a question wrongly.
 *
 * See docs/specs/CC-15-chatbot.md.
 */
import { prisma } from "../../../config/database.js";
import { hybridSearchDoubts } from "../../search/hybridSearch.js";

/** OpenAI-compatible function definition. */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolSet {
  definitions: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}

const MAX_ROWS = 10;

/**
 * Parameter names that would let the model name a user. None of these may ever
 * appear in a tool schema; `assertNoIdentityParameters` enforces it, and a test
 * asserts the same thing independently.
 */
export const FORBIDDEN_PARAM_NAMES = [
  "userid",
  "user_id",
  "studentid",
  "student_id",
  "enrollmentnumber",
  "enrollment_number",
  "email",
  "username",
  "raisedbyid",
  "postedbyid",
  "answeredbyid",
];

/**
 * Fail loudly at construction if a tool ever gains an identity parameter.
 *
 * This is a tripwire for future edits: someone adding `userId` to a tool for
 * convenience gets an immediate crash rather than a silent data leak.
 */
export const assertNoIdentityParameters = (
  definitions: ToolDefinition[],
): void => {
  for (const definition of definitions) {
    for (const param of Object.keys(definition.function.parameters.properties)) {
      if (FORBIDDEN_PARAM_NAMES.includes(param.toLowerCase())) {
        throw new Error(
          `Tool "${definition.function.name}" declares an identity parameter ` +
            `"${param}". Tools must never accept identity — the caller is bound ` +
            `at construction. See docs/specs/CC-15-chatbot.md.`,
        );
      }
    }
  }
};

const humanDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Build the tool set for one authenticated user.
 *
 * `userId` comes from the verified JWT via `authenticate`, never from anything
 * the model or the request body can influence.
 */
export const buildStudentTools = (userId: string): ToolSet => {
  const definitions: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "getMyComplaints",
        description:
          "Get the complaints raised by the student you are helping, including status, location and when they were raised. Returns all of them, so filter in your answer rather than asking for a subset. Use this for any question about their complaints.",
        parameters: {
          // Deliberately no parameters.
          //
          // An optional `status` filter was tried and removed: the model sends
          // `status: null` when it has no value, and Groq rejects the whole
          // call with a 400 because the schema says string. Optional scalars
          // are a live minefield with strict tool-argument validation.
          //
          // Removing it also removes an argument surface, which suits the
          // security model here — the fewer inputs a tool accepts, the less
          // there is to manipulate.
          type: "object",
          properties: {},
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getMyDoubts",
        description:
          "Get the doubts posted by the student you are helping, with how many answers each has received.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "getMyAnswers",
        description:
          "Get answers the student has written, and whether each was approved.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "getMyNotifications",
        description:
          "Get the student's unread notifications. Use for questions like 'do I have any updates'.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "searchDoubts",
        description:
          "Search doubts posted by anyone on the campus, by meaning as well as wording. Use when the student asks whether something has already been asked.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "What to search for.",
            },
          },
          required: ["query"],
        },
      },
    },
  ];

  assertNoIdentityParameters(definitions);

  const handlers: Record<string, ToolHandler> = {
    /** Scoped by raisedById in code — not by anything the model supplied. */
    getMyComplaints: async () => {
      const rows = await prisma.complaint.findMany({
        where: { raisedById: userId },
        select: {
          title: true,
          status: true,
          category: true,
          block: true,
          classroomNumber: true,
          createdAt: true,
          resolutionNote: true,
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });

      return rows.map((row) => ({
        title: row.title,
        status: row.status,
        category: row.category,
        location: `${row.block}/${row.classroomNumber}`,
        raisedOn: humanDate(row.createdAt),
        assignedTo: row.assignedTo?.name ?? null,
        resolutionNote: row.resolutionNote,
      }));
    },

    getMyDoubts: async () => {
      const rows = await prisma.doubt.findMany({
        where: { postedById: userId },
        select: {
          title: true,
          subject: true,
          status: true,
          answerCount: true,
          views: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });

      return rows.map((row) => ({ ...row, createdAt: humanDate(row.createdAt) }));
    },

    getMyAnswers: async () => {
      const rows = await prisma.answer.findMany({
        where: { answeredById: userId },
        select: {
          content: true,
          approvalStatus: true,
          isVerified: true,
          isAccepted: true,
          upvotes: true,
          createdAt: true,
          doubt: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });

      return rows.map((row) => ({
        doubtTitle: row.doubt.title,
        // Truncated: the model needs enough to identify it, not the whole text.
        excerpt: row.content.slice(0, 160),
        approvalStatus: row.approvalStatus,
        isVerified: row.isVerified,
        isAccepted: row.isAccepted,
        upvotes: row.upvotes,
        answeredOn: humanDate(row.createdAt),
      }));
    },

    getMyNotifications: async () => {
      const rows = await prisma.notification.findMany({
        where: { userId, read: false },
        select: { title: true, message: true, type: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
      });

      return rows.map((row) => ({ ...row, createdAt: humanDate(row.createdAt) }));
    },

    /**
     * Public data, so no user scoping applies — but note it returns titles and
     * subjects only, never the author, so this cannot be used to profile who
     * asked what.
     */
    searchDoubts: async (args) => {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (query.length < 3) return { results: [], note: "Query too short" };

      const { doubts } = await hybridSearchDoubts(query, { limit: 5 });

      return doubts.map((doubt) => ({
        title: doubt.title,
        subject: doubt.subject,
        answers: doubt._count.answers,
      }));
    },
  };

  return { definitions, handlers };
};
