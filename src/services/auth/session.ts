/**
 * Finishing a login (CC-01b, CC-60, CC-62, CC-63).
 *
 * There are now four ways to prove a first factor - password, email code -
 * and two second factors - face, TOTP. Every one of them must end the same
 * way, and before this module each path minted its own token: the face path
 * had already drifted (it skipped the admin last-login stamp). One function
 * now decides what a verified first factor earns, and one function issues the
 * session.
 */

import { Role } from "@prisma/client";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, prisma } from "../../config/database.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  FACE_LOGIN_ENABLED,
  TOTP_ENABLED,
} from "../../config/env.js";
import { issueFaceChallenge } from "./faceChallenge.js";
import { issueMfaChallenge } from "./mfa.js";
import { issueRefreshToken } from "./refreshTokens.js";

/** The columns every login path selects. */
export const SESSION_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  userID: true,
  university: true,
  role: true,
  approvalStatus: true,
  faceDescriptorEnc: true,
  totpEnabledAt: true,
  erasedAt: true,
} as const;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  userID: string;
  university: string;
  role: Role;
  approvalStatus: string;
  faceDescriptorEnc: string | null;
  totpEnabledAt: Date | null;
  erasedAt: Date | null;
}

/** Mint the access and refresh tokens, and mark the user active. */
export const issueSession = async (req: Request, user: SessionUser) => {
  await prisma.user.update({
    where: { id: user.id },
    data: { isActive: true },
    select: { id: true },
  });

  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    await prisma.adminProfile.updateMany({
      where: { userId: user.id },
      data: { lastLoginAt: new Date() },
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      userID: user.userID,
      university: user.university,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );

  // CC-01b: the access token is short-lived and cannot be revoked; this is
  // the revocable half of the session.
  const issuedRefresh = await issueRefreshToken(
    user.id,
    req.headers["user-agent"],
  );

  return {
    message: "Login successful",
    token,
    refreshToken: issuedRefresh.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      userID: user.userID,
      university: user.university,
      role: user.role,
      approvalStatus: user.approvalStatus,
      isActive: true,
    },
  };
};

/**
 * What a verified FIRST factor earns: a session, or a challenge for the
 * second factor. No token is issued while a second factor is owed.
 *
 * TOTP takes precedence over face when both are enrolled. TOTP has recovery
 * codes; face has no way back for someone whose camera is broken, so it is
 * the weaker choice to force.
 */
export const afterFirstFactor = async (req: Request, user: SessionUser) => {
  if (TOTP_ENABLED && user.totpEnabledAt) {
    const challenge = await issueMfaChallenge(user.id);
    return {
      requiresTotp: true as const,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      expiresInSeconds: challenge.expiresInSeconds,
    };
  }

  // CC-60: enrolling a face IS opting in; a skippable second factor is not one.
  if (FACE_LOGIN_ENABLED && user.faceDescriptorEnc) {
    const challenge = await issueFaceChallenge(user.id);
    return {
      requiresFace: true as const,
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      expiresInSeconds: challenge.expiresInSeconds,
    };
  }

  return issueSession(req, user);
};
