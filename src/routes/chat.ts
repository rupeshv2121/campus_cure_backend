import { Router } from "express";
import type { Response } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import {
  askAssistant,
  type AssistantTurn,
} from "../services/ai/chat/assistant.js";
import type { AuthRequest } from "../types/index.js";

const router = Router();

/**
 * CC-15: ask the assistant.
 *
 * The user id comes from the verified token via `authenticate` — never from the
 * body. Tools are constructed around that id, so no request payload can reach
 * another student's data.
 */
router.post(
  "/",
  authenticate,
  authorize(Role.STUDENT),
  chatLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const { message, history } = req.body as {
        message?: unknown;
        history?: unknown;
      };

      if (typeof message !== "string") {
        res.status(400).json({ error: "A message is required" });
        return;
      }

      // History is client-supplied and therefore untrusted: shape-check it and
      // drop anything unexpected rather than replaying it to the model.
      const turns: AssistantTurn[] = Array.isArray(history)
        ? history
            .filter(
              (turn): turn is AssistantTurn =>
                Boolean(turn) &&
                typeof turn === "object" &&
                typeof (turn as AssistantTurn).content === "string" &&
                ["user", "assistant"].includes((turn as AssistantTurn).role),
            )
            .slice(-10)
        : [];

      const result = await askAssistant(req.user!.id, message, turns);
      res.json(result);
    } catch (error) {
      console.error("Chat error:", error);
      // Chat is allowed to fail — nothing else depends on it.
      res.json({
        reply: "The assistant is unavailable right now. Please try again later.",
        toolsUsed: [],
        degraded: true,
      });
    }
  },
);

export default router;
