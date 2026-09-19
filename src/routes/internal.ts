import { Router } from "express";
import type { Request, Response } from "express";
import { CRON_SECRET, INTERNAL_API_SECRET } from "../config/env.js";
import { getEmbeddingStats } from "../repositories/embeddingRepository.js";
import { runEmbeddingDrain } from "../services/ai/embeddingWorker.js";
import { runDraftGeneration } from "../services/ai/answerDraft.js";

const router = Router();

/**
 * Internal endpoints are machine-to-machine (Vercel cron), so they are guarded
 * by a shared secret rather than user authentication — there is no user to
 * authenticate. Compared in constant time to avoid leaking the secret through
 * response timing.
 */
const requireInternalSecret = (req: Request, res: Response): boolean => {
  const accepted = [INTERNAL_API_SECRET, CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );

  if (accepted.length === 0) {
    res.status(503).json({ error: "Internal API is not configured" });
    return false;
  }

  // Our own callers send x-internal-secret. Vercel Cron sends
  // `Authorization: Bearer $CRON_SECRET`, so both are accepted.
  const header = req.headers["x-internal-secret"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromBearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;

  const provided = fromHeader ?? fromBearer;

  if (!provided || !accepted.some((secret) => timingSafeEqual(provided, secret))) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

/**
 * Drain the embedding queue.
 *
 * Registered for GET as well as POST because Vercel Cron only issues GET
 * requests. Triggered by cron, and opportunistically after a doubt is posted.
 */
const drainHandler = async (req: Request, res: Response): Promise<void> => {
  if (!requireInternalSecret(req, res)) return;

  try {
    const result = await runEmbeddingDrain();
    res.json(result);
  } catch (error) {
    console.error("[internal] embedding drain failed:", error);
    res.status(500).json({ error: "Drain failed" });
  }
};

router.post("/embeddings/drain", drainHandler);
router.get("/embeddings/drain", drainHandler);

/** Queue health, for verifying a backfill and for spotting parked jobs. */
router.get("/embeddings/stats", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await getEmbeddingStats());
  } catch (error) {
    console.error("[internal] embedding stats failed:", error);
    res.status(500).json({ error: "Stats failed" });
  }
});

/** CC-12: draft answers for the oldest eligible unanswered doubts. */
const draftHandler = async (req: Request, res: Response): Promise<void> => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await runDraftGeneration());
  } catch (error) {
    console.error("[internal] draft generation failed:", error);
    res.status(500).json({ error: "Draft generation failed" });
  }
};

router.post("/drafts/generate", draftHandler);
router.get("/drafts/generate", draftHandler);

export default router;
