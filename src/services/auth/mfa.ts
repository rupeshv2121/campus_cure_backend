/**
 * Second factors and passwordless codes (CC-62, CC-63).
 *
 * Everything here that is stored is stored as something that cannot be used
 * directly: TOTP secrets encrypted, recovery codes and challenge nonces
 * hashed, email codes HMAC'd. A copy of these tables is not a set of
 * credentials.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "node:crypto";
import { prisma } from "../../config/database.js";
import {
  EMAIL_LOGIN_MAX_ATTEMPTS,
  EMAIL_LOGIN_TTL_SECONDS,
  MFA_CHALLENGE_TTL_SECONDS,
  MFA_ENCRYPTION_KEY,
  MFA_MAX_ATTEMPTS,
} from "../../config/env.js";

export class MfaError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "MfaError";
  }
}

const KEY_LENGTH = 32;

const key = (): Buffer => {
  if (!MFA_ENCRYPTION_KEY) {
    throw new MfaError("Two-factor authentication is not configured.", 503);
  }
  const buffer = Buffer.from(MFA_ENCRYPTION_KEY, "base64");
  if (buffer.length !== KEY_LENGTH) {
    throw new MfaError(
      `MFA_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes. Generate one: openssl rand -base64 32`,
      503,
    );
  }
  return buffer;
};

/* ---------------------------------------------------------------- *
 * Encryption at rest, for TOTP secrets.
 * ---------------------------------------------------------------- */

/** AES-256-GCM to "iv:tag:ciphertext", base64. Fresh IV per call. */
export const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
};

export const decryptSecret = (stored: string): string => {
  const [iv, tag, ciphertext] = stored.split(":").map((part) => Buffer.from(part, "base64"));
  if (!iv || !tag || !ciphertext) throw new MfaError("Stored secret is malformed.", 500);

  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/** Keyed, because a six-digit code has too few values for a plain hash. */
const hmac = (value: string): string =>
  createHmac("sha256", key()).update(value).digest("hex");

/* ---------------------------------------------------------------- *
 * Recovery codes.
 * ---------------------------------------------------------------- */

export const RECOVERY_CODE_COUNT = 10;

/** Unambiguous characters only: no 0/O, 1/I/L, so a code read off paper works. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "XXXXX-XXXXX": ten characters from 31, about 49 bits. */
export const generateRecoveryCode = (): string => {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`;
};

/** Case, spaces and the dash are forgiven; everything else must match. */
export const normaliseRecoveryCode = (code: string): string =>
  code.replace(/[\s-]/g, "").toUpperCase();

export const hashRecoveryCode = (code: string): string =>
  sha256(normaliseRecoveryCode(code));

/**
 * Replace a user's recovery codes. Returns the new codes - the only time they
 * exist in plaintext.
 */
export const replaceRecoveryCodes = async (userId: string): Promise<string[]> => {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    }),
  ]);

  return codes;
};

/** Spend one recovery code. True if it was valid and unused. */
export const consumeRecoveryCode = async (
  userId: string,
  code: string,
): Promise<boolean> => {
  // A single conditional update, so two simultaneous requests with the same
  // code cannot both succeed.
  const { count } = await prisma.recoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(code), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
};

export const remainingRecoveryCodes = (userId: string): Promise<number> =>
  prisma.recoveryCode.count({ where: { userId, usedAt: null } });

/* ---------------------------------------------------------------- *
 * The half-finished login: password correct, TOTP still owed.
 * Same design as CC-60's FaceChallenge.
 * ---------------------------------------------------------------- */

export interface IssuedMfaChallenge {
  challengeId: string;
  nonce: string;
  expiresInSeconds: number;
}

export const issueMfaChallenge = async (
  userId: string,
): Promise<IssuedMfaChallenge> => {
  // One live challenge per user: logging in again supersedes the last one.
  await prisma.mfaChallenge.deleteMany({ where: { userId, consumedAt: null } });

  const nonce = randomBytes(32).toString("base64url");
  const challenge = await prisma.mfaChallenge.create({
    data: {
      userId,
      nonceHash: sha256(nonce),
      expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_SECONDS * 1000),
    },
  });

  return {
    challengeId: challenge.id,
    nonce,
    expiresInSeconds: MFA_CHALLENGE_TTL_SECONDS,
  };
};

/**
 * Count an attempt against a challenge and return its user, or null.
 *
 * The attempt is recorded BEFORE the nonce is compared, so a caller guessing
 * nonces burns the same budget as one guessing codes.
 */
export const claimMfaChallenge = async (
  challengeId: string,
  nonce: string,
): Promise<string | null> => {
  if (!challengeId || !nonce) return null;

  const challenge = await prisma.mfaChallenge.findUnique({
    where: { id: challengeId },
  });

  if (
    !challenge ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.attempts >= MFA_MAX_ATTEMPTS
  ) {
    return null;
  }

  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 } },
  });

  return challenge.nonceHash === sha256(nonce) ? challenge.userId : null;
};

/** Mark a challenge used. Conditional, so it can only succeed once. */
export const consumeMfaChallenge = async (challengeId: string): Promise<boolean> => {
  const { count } = await prisma.mfaChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count === 1;
};

/* ---------------------------------------------------------------- *
 * Email login codes (CC-63).
 * ---------------------------------------------------------------- */

export const generateEmailCode = (): string =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Issue a code for a user, replacing any outstanding one. */
export const issueEmailLoginCode = async (userId: string): Promise<string> => {
  const code = generateEmailCode();

  await prisma.$transaction([
    prisma.emailLoginCode.deleteMany({ where: { userId, consumedAt: null } }),
    prisma.emailLoginCode.create({
      data: {
        userId,
        codeHash: hmac(code),
        expiresAt: new Date(Date.now() + EMAIL_LOGIN_TTL_SECONDS * 1000),
      },
    }),
  ]);

  return code;
};

/**
 * Check and spend an email code. True on success.
 *
 * Every wrong guess counts against the outstanding code, and the code dies
 * at the limit - so the million-value space is never searchable.
 */
export const verifyEmailLoginCode = async (
  userId: string,
  code: string,
): Promise<boolean> => {
  const outstanding = await prisma.emailLoginCode.findFirst({
    where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!outstanding || outstanding.attempts >= EMAIL_LOGIN_MAX_ATTEMPTS) {
    return false;
  }

  const normalised = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalised) || outstanding.codeHash !== hmac(normalised)) {
    await prisma.emailLoginCode.update({
      where: { id: outstanding.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  const { count } = await prisma.emailLoginCode.updateMany({
    where: { id: outstanding.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count === 1;
};

/** Daily cleanup of dead challenges and codes. */
export const purgeExpiredMfaRecords = async (): Promise<number> => {
  const cutoff = new Date();
  const [challenges, codes] = await prisma.$transaction([
    prisma.mfaChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    prisma.emailLoginCode.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
  ]);
  return challenges.count + codes.count;
};
