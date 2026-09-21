/**
 * Reputation reads (CC-25).
 *
 * Students and faculty only: the doubt community is theirs, and an admin
 * appearing on its leaderboard would be measuring the wrong thing.
 */

import { Role } from "@prisma/client";
import { Router } from "express";
import type { Response } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getLeaderboard,
  getReputationHistory,
  getReputationSummary,
} from "../services/reputation/reputation.js";
import type { AuthRequest } from "../types/index.js";

const router = Router();

/** The caller's own score, rank and distance to the next one. */
router.get(
  "/me",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  async (req: AuthRequest, res: Response) => {
    try {
      res.json(await getReputationSummary(req.user!.id));
    } catch (error) {
      console.error("[CC-25] summary failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/** Why they have the score they have. Own ledger only. */
router.get(
  "/me/history",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      res.json({ events: await getReputationHistory(req.user!.id, limit) });
    } catch (error) {
      console.error("[CC-25] history failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get(
  "/leaderboard",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 20;
      res.json({ leaderboard: await getLeaderboard(limit) });
    } catch (error) {
      console.error("[CC-25] leaderboard failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
