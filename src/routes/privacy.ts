/**
 * Data principal rights (CC-64).
 *
 * Everything here acts on the CALLER'S OWN data and is keyed by the session,
 * never by an id in the path. There is deliberately no admin route to export
 * or erase somebody else: those are rights the person exercises, and an
 * "erase this user" button is a weapon.
 *
 * See docs/specs/CC-64-dpdp.md.
 */

import { Router } from "express";
import type { Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { AuditAction, auditFromRequest } from "../services/audit/auditLog.js";
import {
  CONSENT_PURPOSES,
  eraseUser,
  exportUserData,
  getConsentHistory,
  hasCurrentConsent,
  recordConsent,
} from "../services/privacy/dataRights.js";
import { DPDP_POLICY_VERSION } from "../config/env.js";
import type { AuthRequest } from "../types/index.js";

const router = Router();

/** What we hold, why, and whether this user has agreed to the current policy. */
router.get("/consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      policyVersion: DPDP_POLICY_VERSION,
      purposes: CONSENT_PURPOSES,
      hasCurrentConsent: await hasCurrentConsent(req.user!.id),
      history: await getConsentHistory(req.user!.id),
    });
  } catch (error) {
    console.error("[CC-64] consent read failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Grant or withdraw.
 *
 * Withdrawal is recorded and does NOT erase the account - they are separate
 * rights, and conflating them would surprise someone who only wanted the
 * emails to stop.
 */
router.post("/consent", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const granted = req.body?.granted;

    if (typeof granted !== "boolean") {
      res.status(400).json({ error: "granted must be true or false" });
      return;
    }

    const record = await recordConsent({
      userId: req.user!.id,
      granted,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ record });
  } catch (error) {
    console.error("[CC-64] consent write failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Everything held about the caller, as JSON. */
router.get(
  "/data-export",
  authenticate,
  authLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await exportUserData(req.user!.id);

      if (!data) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      await auditFromRequest(req, {
        action: AuditAction.DATA_EXPORT,
        targetType: "User",
        targetId: req.user!.id,
        summary: "Exported own personal data",
      });

      res
        .setHeader(
          "Content-Disposition",
          `attachment; filename="campuscure-data-export.json"`,
        )
        .json(data);
    } catch (error) {
      console.error("[CC-64] export failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Erasure.
 *
 * Requires the account's own session and an explicit confirmation string, and
 * it cannot be undone without a database backup. Anonymisation rather than
 * deletion - see the service for why that is forced rather than chosen.
 */
router.post(
  "/erase",
  authenticate,
  authLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.body?.confirm !== "ERASE MY DATA") {
        res.status(400).json({
          error: 'Send { "confirm": "ERASE MY DATA" } to proceed. This cannot be undone.',
        });
        return;
      }

      // Audited BEFORE the erasure, while the actor still has a name. Doing it
      // after would record a tombstone erasing itself.
      await auditFromRequest(req, {
        action: AuditAction.DATA_ERASE,
        targetType: "User",
        targetId: req.user!.id,
        summary: "Erasure requested by the data principal",
      });

      const result = await eraseUser(req.user!.id);

      res.json({
        message: result.alreadyErased
          ? "This account was already erased."
          : "Your personal data has been erased. Content you posted remains, attributed to a deleted account.",
        ...result,
      });
    } catch (error) {
      console.error("[CC-64] erasure failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
