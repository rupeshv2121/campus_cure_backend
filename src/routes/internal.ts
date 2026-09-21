import { Router } from "express";
import type { Request, Response } from "express";
import { CRON_SECRET, INTERNAL_API_SECRET } from "../config/env.js";
import { getEmbeddingStats } from "../repositories/embeddingRepository.js";
import { runEmbeddingDrain } from "../services/ai/embeddingWorker.js";
import { runDraftGeneration } from "../services/ai/answerDraft.js";
import { purgeExpiredRefreshTokens } from "../services/auth/refreshTokens.js";
import { purgeExpiredFaceChallenges } from "../services/auth/faceChallenge.js";
import { getSlaStats, runSlaSweep } from "../services/sla/escalation.js";
import { sweepAttachments } from "../services/storage/attachments.js";
import {
  enqueueEmail,
  getEmailStats,
  runEmailDrain,
} from "../services/email/outbox.js";

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

/* ------------------------------------------------------------------ *
 * CC-03: email outbox
 * ------------------------------------------------------------------ */

/** Send whatever is due. Also reachable from cron, below. */
const emailDrainHandler = async (req: Request, res: Response): Promise<void> => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await runEmailDrain());
  } catch (error) {
    console.error("[internal] email drain failed:", error);
    res.status(500).json({ error: "Email drain failed" });
  }
};

router.post("/email/drain", emailDrainHandler);
router.get("/email/drain", emailDrainHandler);

/** Queue health: what is waiting, and what never went out and why. */
router.get("/email/stats", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await getEmailStats());
  } catch (error) {
    console.error("[internal] email stats failed:", error);
    res.status(500).json({ error: "Email stats failed" });
  }
});

/**
 * Send one test message.
 *
 * Exists so the pipe can be exercised end to end before any feature depends on
 * it - CC-40 owns the real emails. Behind the shared secret like everything
 * else here, because an open "send mail to an address of your choosing"
 * endpoint is an open relay.
 */
router.post("/email/test", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;

  try {
    const to = typeof req.body?.to === "string" ? req.body.to : "";

    const queued = await enqueueEmail({
      to,
      subject: "CampusCure email test (CC-03)",
      text: [
        "If you are reading this, the outbox, the drain and the Resend",
        "integration all work.",
        "",
        "No feature sends email yet - that is CC-40.",
      ].join("\n"),
      // Timestamped on purpose: a test SHOULD be repeatable, unlike a real
      // notification, so this key is the one place a timestamp belongs.
      dedupeKey: `test:${Date.now()}`,
    });

    if (!queued.queued) {
      res.status(400).json({ error: `Not queued: ${queued.reason}` });
      return;
    }

    // Awaited rather than backgrounded so the response reports the real
    // outcome - the whole point of the endpoint is to find out.
    const drain = await runEmailDrain();
    res.json({ queued, drain, stats: await getEmailStats() });
  } catch (error) {
    console.error("[internal] email test failed:", error);
    res.status(500).json({ error: "Email test failed" });
  }
});

/* ------------------------------------------------------------------ *
 * CC-31: SLA sweep
 * ------------------------------------------------------------------ */

/**
 * Escalate whatever is overdue.
 *
 * Also reachable directly, which matters more than it looks: the cron runs
 * once a day, so without this a demo of the escalation ladder would mean
 * waiting until 02:00.
 */
const slaSweepHandler = async (req: Request, res: Response): Promise<void> => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await runSlaSweep());
  } catch (error) {
    console.error("[internal] SLA sweep failed:", error);
    res.status(500).json({ error: "SLA sweep failed" });
  }
};

router.post("/sla/sweep", slaSweepHandler);
router.get("/sla/sweep", slaSweepHandler);

/** What is overdue, what is due soon, and what has already escalated. */
router.get("/sla/stats", async (req: Request, res: Response) => {
  if (!requireInternalSecret(req, res)) return;

  try {
    res.json(await getSlaStats());
  } catch (error) {
    console.error("[internal] SLA stats failed:", error);
    res.status(500).json({ error: "SLA stats failed" });
  }
});

/**
 * One daily job doing all the scheduled work.
 *
 * Consolidated deliberately: Vercel's Hobby plan caps both the number of cron
 * entries and their frequency, and two separate entries sat right at that
 * limit. One endpoint is also easier to reason about — the whole nightly
 * routine either ran or it did not.
 *
 * Each step is independent: a failure in one is reported and the rest still
 * run, because a rate-limited embedding provider should not stop expired
 * refresh tokens being cleaned up.
 */
const dailyHandler = async (req: Request, res: Response): Promise<void> => {
  if (!requireInternalSecret(req, res)) return;

  const results: Record<string, unknown> = {};

  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      results[name] = await run();
    } catch (error) {
      console.error(`[cron] ${name} failed:`, (error as Error).message);
      results[name] = { error: (error as Error).message };
    }
  };

  await step("embeddings", () => runEmbeddingDrain());
  await step("drafts", () => runDraftGeneration());
  await step("purgedRefreshTokens", async () => ({
    deleted: await purgeExpiredRefreshTokens(),
  }));
  // CC-02: unconfirmed uploads and files whose parent was deleted. Objects are
  // billable whether or not anything points at them, so this runs nightly.
  await step("sweptAttachments", () => sweepAttachments());
  // CC-03: the floor on retry latency, not the mechanism. Mail is normally
  // sent by the opportunistic drain within a second of being queued; this
  // catches anything left PENDING because a lambda froze mid-drain.
  // CC-31 runs BEFORE the email drain, deliberately. The sweep queues
  // escalation notices, and those are the most time-sensitive messages this
  // job produces - draining first would leave them in the outbox until
  // tomorrow's run.
  await step("sla", () => runSlaSweep());
  await step("emails", () => runEmailDrain());
  // CC-60: face challenges are short-lived by design; expired rows are just
  // litter, but litter that accumulates once per failed login.
  await step("purgedFaceChallenges", async () => ({
    deleted: await purgeExpiredFaceChallenges(),
  }));

  res.json(results);
};

router.post("/cron/daily", dailyHandler);
router.get("/cron/daily", dailyHandler);

export default router;
