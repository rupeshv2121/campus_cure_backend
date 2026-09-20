/**
 * Refresh token issue, rotation and revocation — CC-01b.
 *
 * The token is opaque random bytes, not a JWT: it carries no claims, so it
 * cannot be inspected or trusted on its own. Its only meaning is "this row
 * exists and is not revoked". Only the SHA-256 hash is stored, so a database
 * leak does not hand over working sessions.
 *
 * See docs/specs/CC-01b-refresh-tokens.md.
 */
import { createHash, randomBytes } from "node:crypto";
import { REFRESH_TOKEN_TTL_DAYS } from "../../config/env.js";
import { prisma } from "../../config/database.js";

/**
 * Hash for storage and lookup.
 *
 * A fast hash is correct here, unlike for passwords: the token is 48 bytes of
 * cryptographic randomness, so there is no dictionary to attack.
 */
const hash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export const issueRefreshToken = async (
  userId: string,
  userAgent?: string | undefined,
): Promise<IssuedRefreshToken> => {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash(token),
      expiresAt,
      ...(userAgent ? { userAgent: userAgent.slice(0, 255) } : {}),
    },
  });

  return { token, expiresAt };
};

export type RotateFailure =
  | "not_found"
  | "expired"
  | "reused"
  | "user_inactive";

export type RotateResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: RotateFailure };

/**
 * Exchange a refresh token for a new one.
 *
 * Rotation means a token is valid exactly once. Presenting an already-revoked
 * token is not a benign retry — the only way it happens is that someone kept a
 * copy — so every token for that user is revoked and the session ends.
 *
 * That is the whole reason rotation is worth the complexity: without it, a
 * stolen refresh token is usable for its full lifetime, undetected.
 */
export const rotateRefreshToken = async (
  presented: string,
): Promise<RotateResult> => {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(presented) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: { isActive: true } },
    },
  });

  if (!existing) return { ok: false, reason: "not_found" };

  if (existing.revokedAt) {
    await revokeAllForUser(existing.userId);
    return { ok: false, reason: "reused" };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  // A deactivated account must not be able to refresh its way back in.
  if (!existing.user.isActive) {
    return { ok: false, reason: "user_inactive" };
  }

  const issued = await issueRefreshToken(existing.userId);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return { ok: true, userId: existing.userId, token: issued.token };
};

/** Revoke a single token. Used by logout; silent if the token is unknown. */
export const revokeRefreshToken = async (presented: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const revokeAllForUser = async (userId: string): Promise<number> => {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
};

/** Cron housekeeping: drop rows that can no longer authorise anything. */
export const purgeExpiredRefreshTokens = async (): Promise<number> => {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
};

/** Exposed so tests can assert the raw token is never stored. */
export const hashRefreshToken = hash;
