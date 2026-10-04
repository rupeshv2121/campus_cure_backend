/**
 * Two-factor authentication (CC-62) and email login codes (CC-63).
 *
 *   GET  /api/auth/2fa                 status
 *   POST /api/auth/2fa/setup           new pending secret + QR URI
 *   POST /api/auth/2fa/enable          { code } -> recovery codes
 *   POST /api/auth/2fa/disable         { password, code }
 *   POST /api/auth/2fa/recovery-codes  { code } -> fresh recovery codes
 *   POST /api/auth/2fa/verify          { challengeId, nonce, code | recoveryCode } -> session
 *
 *   POST /api/auth/email-login/request { email }
 *   POST /api/auth/email-login/verify  { email, code } -> session or 2FA challenge
 *
 * See docs/specs/CC-62-totp-2fa.md and CC-63-email-otp.md.
 */

import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import {
  EMAIL_LOGIN_ENABLED,
  EMAIL_LOGIN_TTL_SECONDS,
  TOTP_ENABLED,
  TOTP_ISSUER,
} from "../config/env.js";
import { AuditAction, auditFromRequest } from "../services/audit/auditLog.js";
import {
  MfaError,
  claimMfaChallenge,
  consumeMfaChallenge,
  consumeRecoveryCode,
  decryptSecret,
  encryptSecret,
  issueEmailLoginCode,
  remainingRecoveryCodes,
  replaceRecoveryCodes,
  verifyEmailLoginCode,
} from "../services/auth/mfa.js";
import {
  SESSION_USER_SELECT,
  afterFirstFactor,
  issueSession,
} from "../services/auth/session.js";
import { generateTotpSecret, otpauthUri, verifyTotp } from "../services/auth/totp.js";
import { revokeAllForUser } from "../services/auth/refreshTokens.js";
import { sendEmail } from "../services/email/resend.js";
import { escapeHtml } from "../services/email/templates.js";
import type { AuthRequest } from "../types/index.js";

const fail = (res: Response, error: unknown, label: string): void => {
  if (error instanceof MfaError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(`[CC-62] ${label}:`, error);
  res.status(500).json({ error: "Internal server error" });
};

const requireTotp = () => {
  if (!TOTP_ENABLED) {
    throw new MfaError("Two-factor authentication is not configured.", 503);
  }
};

/**
 * Check a code against a user's ACTIVE secret, advancing the replay guard.
 * Used for login and for every sensitive change once 2FA is on.
 */
const checkActiveCode = async (userId: string, code: unknown): Promise<boolean> => {
  if (typeof code !== "string") return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecretEnc: true, totpLastStep: true },
  });
  if (!user?.totpSecretEnc) return false;

  const step = verifyTotp(decryptSecret(user.totpSecretEnc), code, {
    lastStep: user.totpLastStep,
  });
  if (step === null) return false;

  // Conditional on the step not having moved, so two requests racing with the
  // same code cannot both be accepted.
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
    },
    data: { totpLastStep: step },
  });
  return count === 1;
};

/* ---------------------------------------------------------------- *
 * Enrolment and management (authenticated).
 * ---------------------------------------------------------------- */

export const getTwoFactorStatus = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { totpEnabledAt: true },
    });

    res.json({
      available: TOTP_ENABLED,
      enabled: Boolean(user?.totpEnabledAt),
      enabledAt: user?.totpEnabledAt ?? null,
      recoveryCodesRemaining: user?.totpEnabledAt
        ? await remainingRecoveryCodes(req.user!.id)
        : 0,
      emailLoginAvailable: EMAIL_LOGIN_ENABLED,
    });
  } catch (error) {
    fail(res, error, "status");
  }
};

/** Start enrolment: a pending secret that does nothing until confirmed. */
export const setupTwoFactor = async (req: AuthRequest, res: Response) => {
  try {
    requireTotp();

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true, totpEnabledAt: true },
    });
    if (!user) throw new MfaError("User not found.", 404);
    if (user.totpEnabledAt) {
      throw new MfaError("Two-factor authentication is already on.", 409);
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { totpPendingSecretEnc: encryptSecret(secret) },
    });

    res.json({
      secret,
      otpauthUrl: otpauthUri(secret, user.email, TOTP_ISSUER),
    });
  } catch (error) {
    fail(res, error, "setup");
  }
};

/**
 * Confirm enrolment with a working code. Only now does the secret become the
 * login secret - an app that was set up wrong cannot lock anyone out.
 */
export const enableTwoFactor = async (req: AuthRequest, res: Response) => {
  try {
    requireTotp();
    const { code } = req.body as { code?: unknown };

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { totpPendingSecretEnc: true, totpEnabledAt: true },
    });
    if (!user) throw new MfaError("User not found.", 404);
    if (user.totpEnabledAt) {
      throw new MfaError("Two-factor authentication is already on.", 409);
    }
    if (!user.totpPendingSecretEnc) {
      throw new MfaError("Start setup first.", 400);
    }

    const step =
      typeof code === "string"
        ? verifyTotp(decryptSecret(user.totpPendingSecretEnc), code)
        : null;
    if (step === null) {
      throw new MfaError(
        "That code did not match. Check the time on your phone and try the next code.",
        400,
      );
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        totpSecretEnc: user.totpPendingSecretEnc,
        totpPendingSecretEnc: null,
        totpEnabledAt: new Date(),
        totpLastStep: step,
      },
    });

    const recoveryCodes = await replaceRecoveryCodes(req.user!.id);

    await auditFromRequest(req, {
      action: AuditAction.MFA_ENABLE,
      targetType: "User",
      targetId: req.user!.id,
      summary: "Enabled two-factor authentication",
    });

    res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    fail(res, error, "enable");
  }
};

/**
 * Turn 2FA off. Needs the password AND a current code (or a recovery code):
 * a stolen session alone must not be able to remove the second factor.
 */
export const disableTwoFactor = async (req: AuthRequest, res: Response) => {
  try {
    const { password, code, recoveryCode } = req.body as {
      password?: unknown;
      code?: unknown;
      recoveryCode?: unknown;
    };
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, totpEnabledAt: true },
    });
    if (!user?.totpEnabledAt) {
      throw new MfaError("Two-factor authentication is not on.", 409);
    }

    const passwordOk =
      typeof password === "string" && (await bcrypt.compare(password, user.password));
    const secondOk =
      (await checkActiveCode(userId, code)) ||
      (typeof recoveryCode === "string" &&
        (await consumeRecoveryCode(userId, recoveryCode)));

    if (!passwordOk || !secondOk) {
      throw new MfaError("Password or code is incorrect.", 401);
    }

    await clearTwoFactor(userId);

    await auditFromRequest(req, {
      action: AuditAction.MFA_DISABLE,
      targetType: "User",
      targetId: userId,
      summary: "Disabled two-factor authentication",
    });

    res.json({ enabled: false });
  } catch (error) {
    fail(res, error, "disable");
  }
};

/** New recovery codes, invalidating the old set. Needs a current code. */
export const regenerateRecoveryCodes = async (req: AuthRequest, res: Response) => {
  try {
    requireTotp();
    if (!(await checkActiveCode(req.user!.id, req.body?.code))) {
      throw new MfaError("That code did not match.", 401);
    }

    res.json({ recoveryCodes: await replaceRecoveryCodes(req.user!.id) });
  } catch (error) {
    fail(res, error, "recovery codes");
  }
};

/* ---------------------------------------------------------------- *
 * Second step of login (unauthenticated, rate-limited).
 * ---------------------------------------------------------------- */

export const verifyTwoFactorLogin = async (req: Request, res: Response) => {
  try {
    requireTotp();
    const { challengeId, nonce, code, recoveryCode } = req.body as {
      challengeId?: unknown;
      nonce?: unknown;
      code?: unknown;
      recoveryCode?: unknown;
    };

    if (typeof challengeId !== "string" || typeof nonce !== "string") {
      res.status(400).json({ error: "Challenge is required." });
      return;
    }

    const userId = await claimMfaChallenge(challengeId, nonce);

    // One message for every failure, as CC-60 does: which half was wrong is
    // information for an attacker, not for the user.
    const failed = () =>
      res.status(401).json({ error: "That code did not work. Try again." });

    if (!userId) return failed();

    let usedRecovery = false;
    const ok =
      (await checkActiveCode(userId, code)) ||
      (typeof recoveryCode === "string" &&
        (usedRecovery = await consumeRecoveryCode(userId, recoveryCode)));

    if (!ok || !(await consumeMfaChallenge(challengeId))) return failed();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: SESSION_USER_SELECT,
    });
    if (!user || user.erasedAt) return failed();

    const session = await issueSession(req, user);

    if (usedRecovery) {
      // A spent recovery code is worth knowing about: either the phone is
      // lost, or someone else has the codes.
      await auditFromRequest(req, {
        action: AuditAction.MFA_RECOVERY_USED,
        targetType: "User",
        targetId: userId,
        summary: "Signed in with a recovery code",
      });
    }

    res.json({
      ...session,
      ...(usedRecovery
        ? { recoveryCodesRemaining: await remainingRecoveryCodes(userId) }
        : {}),
    });
  } catch (error) {
    fail(res, error, "verify");
  }
};

/* ---------------------------------------------------------------- *
 * Email login codes (CC-63). Unauthenticated, rate-limited.
 * ---------------------------------------------------------------- */

const GENERIC_SENT =
  "If that address belongs to an account, a sign-in code is on its way.";

/**
 * Send a code. Always answers the same way, whether or not the address
 * exists: anything else lets this endpoint enumerate accounts.
 */
export const requestEmailLogin = async (req: Request, res: Response) => {
  try {
    if (!EMAIL_LOGIN_ENABLED) {
      res.status(503).json({ error: "Email sign-in is not available." });
      return;
    }

    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, erasedAt: null },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      const code = await issueEmailLoginCode(user.id);
      const minutes = Math.round(EMAIL_LOGIN_TTL_SECONDS / 60);

      // Sent directly, NOT through the CC-03 outbox: the outbox stores the
      // body, and a login code at rest in a table is a credential at rest.
      // A failed send is logged and swallowed, so the response stays the
      // same and reveals nothing.
      await sendEmail({
        to: user.email,
        subject: `${code} is your CampusCure sign-in code`,
        text:
          `Hi ${user.name},\n\nYour CampusCure sign-in code is ${code}. ` +
          `It expires in ${minutes} minutes.\n\nIf you did not ask for this, ` +
          `ignore this email - nobody can sign in without the code.`,
        html:
          `<p>Hi ${escapeHtml(user.name)},</p>` +
          `<p>Your CampusCure sign-in code is</p>` +
          `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
          `<p>It expires in ${minutes} minutes.</p>` +
          `<p style="color:#666">If you did not ask for this, ignore this email. ` +
          `Nobody can sign in without the code.</p>`,
      }).catch((error) =>
        console.error("[CC-63] sign-in code email failed:", (error as Error).message),
      );
    }

    res.json({ message: GENERIC_SENT });
  } catch (error) {
    fail(res, error, "email request");
  }
};

/**
 * Exchange a code for whatever a password would have earned: a session, or a
 * 2FA/face challenge. The email code replaces the password, never the second
 * factor.
 */
export const verifyEmailLogin = async (req: Request, res: Response) => {
  try {
    if (!EMAIL_LOGIN_ENABLED) {
      res.status(503).json({ error: "Email sign-in is not available." });
      return;
    }

    const { email, code } = req.body as { email?: unknown; code?: unknown };
    const failed = () =>
      res.status(401).json({ error: "That code is incorrect or has expired." });

    if (typeof email !== "string" || typeof code !== "string") return failed();

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: "insensitive" },
        erasedAt: null,
      },
      select: SESSION_USER_SELECT,
    });
    if (!user || !(await verifyEmailLoginCode(user.id, code))) return failed();

    res.json(await afterFirstFactor(req, user));
  } catch (error) {
    fail(res, error, "email verify");
  }
};

/** Remove every trace of 2FA. Also used by the admin reset. */
export const clearTwoFactor = (userId: string) =>
  prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingSecretEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaChallenge.deleteMany({ where: { userId } }),
  ]);

/**
 * POST /api/admin/users/:userId/2fa/reset  (SUPER_ADMIN)
 *
 * The way back for someone who lost both their phone and their recovery
 * codes. SUPER_ADMIN only: an ADMIN able to strip a fellow admin's second
 * factor is a privilege escalation (see CC-01c). Every session the user has
 * is revoked, so whoever might be holding one is signed out too.
 */
export const adminResetTwoFactor = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, userID: true, totpEnabledAt: true },
    });
    if (!user) throw new MfaError("User not found.", 404);
    if (!user.totpEnabledAt) {
      throw new MfaError("This user does not have two-factor authentication on.", 409);
    }

    await clearTwoFactor(userId);
    const revoked = await revokeAllForUser(userId);

    await auditFromRequest(req, {
      action: AuditAction.MFA_RESET,
      targetType: "User",
      targetId: userId,
      summary: `Reset two-factor authentication for ${user.userID}`,
      metadata: { sessionsRevoked: revoked },
    });

    res.json({ reset: true, sessionsRevoked: revoked });
  } catch (error) {
    fail(res, error, "admin reset");
  }
};

/**
 * GET /api/auth/methods - public. Which sign-in options the login page should
 * offer, so it never shows a button that would answer 503.
 */
export const getLoginMethods = (_req: Request, res: Response): void => {
  res.json({ emailCode: EMAIL_LOGIN_ENABLED });
};
