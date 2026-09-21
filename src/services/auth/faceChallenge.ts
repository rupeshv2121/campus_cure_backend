/**
 * The face verification challenge (CC-60).
 *
 * A challenge exists only once a password has been verified, and it is the
 * only way to reach the face step. Short-lived, single-use and attempt-capped,
 * which is what stops a captured request being replayed and a known account
 * being brute-forced in descriptor space.
 *
 * See docs/specs/CC-60-face-hardening.md.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../config/database.js";
import {
  FACE_CHALLENGE_TTL_SECONDS,
  FACE_MAX_ATTEMPTS,
} from "../../config/env.js";

/** SHA-256, so the stored value is not usable as the credential itself. */
export const hashNonce = (nonce: string): string =>
  createHash("sha256").update(nonce).digest("hex");

export interface IssuedChallenge {
  challengeId: string;
  nonce: string;
  expiresInSeconds: number;
}

/**
 * Create a challenge for a user whose password has just verified.
 *
 * Any earlier unconsumed challenge for that user is dropped: a second login
 * attempt should invalidate the first, or a captured challenge stays usable
 * for as long as the user keeps retrying.
 */
export const issueFaceChallenge = async (
  userId: string,
): Promise<IssuedChallenge> => {
  await prisma.faceChallenge.deleteMany({
    where: { userId, consumedAt: null },
  });

  const nonce = randomBytes(32).toString("base64url");

  const challenge = await prisma.faceChallenge.create({
    data: {
      userId,
      nonceHash: hashNonce(nonce),
      expiresAt: new Date(Date.now() + FACE_CHALLENGE_TTL_SECONDS * 1000),
    },
  });

  return {
    challengeId: challenge.id,
    nonce,
    expiresInSeconds: FACE_CHALLENGE_TTL_SECONDS,
  };
};

export type ClaimFailure =
  | "not-found"
  | "expired"
  | "consumed"
  | "too-many-attempts"
  | "bad-nonce";

export interface ClaimResult {
  ok: boolean;
  userId?: string;
  reason?: ClaimFailure;
}

/**
 * Validate a challenge and count the attempt.
 *
 * The attempt is recorded BEFORE the descriptors are checked, so a caller
 * cannot get unlimited tries by abandoning each request — the cap holds even
 * if the response never arrives.
 *
 * Every failure returns the same shape and the caller reports one generic
 * message: distinguishing "expired" from "wrong nonce" to the client tells an
 * attacker which half of their guess was right.
 */
export const claimFaceChallenge = async (
  challengeId: string,
  nonce: string,
): Promise<ClaimResult> => {
  if (!challengeId || !nonce) return { ok: false, reason: "not-found" };

  const challenge = await prisma.faceChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) return { ok: false, reason: "not-found" };
  if (challenge.consumedAt) return { ok: false, reason: "consumed" };

  if (challenge.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (challenge.attempts >= FACE_MAX_ATTEMPTS) {
    return { ok: false, reason: "too-many-attempts" };
  }

  const attempts = challenge.attempts + 1;
  await prisma.faceChallenge.update({
    where: { id: challenge.id },
    data: { attempts },
  });

  if (challenge.nonceHash !== hashNonce(nonce)) {
    return { ok: false, reason: "bad-nonce" };
  }

  return { ok: true, userId: challenge.userId };
};

/**
 * Burn the challenge.
 *
 * Called on success. Failures leave it open so the user can retry within the
 * attempt cap rather than restarting from the password.
 */
export const consumeFaceChallenge = async (
  challengeId: string,
): Promise<void> => {
  await prisma.faceChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: new Date() },
  });
};

/** Housekeeping for the daily cron. */
export const purgeExpiredFaceChallenges = async (): Promise<number> => {
  const { count } = await prisma.faceChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return count;
};
