import { AdminLevel, ApprovalStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, prisma } from "../config/database.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  FACE_LOGIN_ENABLED,
  FACE_REQUIRED_SAMPLES,
} from "../config/env.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/auth/refreshTokens.js";
import {
  claimFaceChallenge,
  consumeFaceChallenge,
  issueFaceChallenge,
} from "../services/auth/faceChallenge.js";
import {
  AuditAction,
  auditFromRequest,
} from "../services/audit/auditLog.js";
import {
  decryptDescriptor,
  encryptDescriptor,
  isValidDescriptor,
  verifySamples,
} from "../services/auth/faceCrypto.js";
import type { AuthRequest } from "../types/index.js";
import { withRetry } from "../utils/retry.js";

/**
 * Roles a stranger may create for themselves via the public register endpoint.
 */
const SELF_SERVICE_ROLES: Role[] = [Role.STUDENT, Role.FACULTY];

/**
 * Roles that may only be created by an existing SUPER_ADMIN.
 *
 * Without this, `POST /api/auth/register` accepted `role: "SUPER_ADMIN"` straight
 * from the request body. Combined with the approval check being disabled at
 * login, anyone on the internet could register as a super admin and immediately
 * sign in with full access. See docs/specs/CC-01c-privileged-role-escalation.md.
 */
const PRIVILEGED_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

/**
 * Returns true when the request carries a valid bearer token belonging to an
 * active SUPER_ADMIN. The database is consulted rather than trusting the token
 * claim alone, so that a deactivated super admin cannot mint new admins.
 */
const isRequestFromActiveSuperAdmin = async (req: Request): Promise<boolean> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return false;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
    if (!decoded.id) return false;

    const requester = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, isActive: true },
    });

    return (
      !!requester && requester.isActive && requester.role === Role.SUPER_ADMIN
    );
  } catch {
    return false;
  }
};

// 1. Register (Student / Faculty / Admin)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, userID } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role || !userID) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    // Validate role
    const requestedRole = role as Role;
    if (
      ![...SELF_SERVICE_ROLES, ...PRIVILEGED_ROLES].includes(requestedRole)
    ) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    // Privileged roles cannot be self-assigned. Creating an admin or super
    // admin requires an existing, active SUPER_ADMIN to authorise the request.
    if (PRIVILEGED_ROLES.includes(requestedRole)) {
      if (!(await isRequestFromActiveSuperAdmin(req))) {
        res.status(403).json({
          error:
            "Administrator accounts can only be created by an existing super admin.",
        });
        return;
      }
    }

    // Check if user already exists
    const existingUser = await withRetry(() =>
      prisma.user.findFirst({
        where: {
          OR: [{ email }, { userID }],
        },
        select: {
          id: true,
        },
      }),
    );

    if (existingUser) {
      res
        .status(400)
        .json({ error: "User with this email or userID already exists" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with retry
    const user = await withRetry(() =>
      prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          userID,
          role: role as Role,
          approvalStatus: ApprovalStatus.PENDING,
          isActive: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          userID: true,
          university: true,
          role: true,
          approvalStatus: true,
        },
      }),
    );

    // Create corresponding profile based on role
    if (role === "STUDENT") {
      await withRetry(() =>
        prisma.studentProfile.create({
          data: {
            userId: user.id,
            enrollmentNumber: userID,
            department: "Not Set",
            branch: "Not Set",
            semester: 1,
            phoneNumber: "Not Set",
            address: "Not Set",
            guardianName: "Not Set",
            guardianPhone: "Not Set",
            updatedAt: new Date(),
          },
        }),
      );
    } else if (role === "FACULTY") {
      await withRetry(() =>
        prisma.facultyProfile.create({
          data: {
            userId: user.id,
            department: "Not Set",
            branch: "Not Set",
            phoneNumber: "Not Set",
            address: "Not Set",
            subjects: [],
          },
        }),
      );
    } else if (role === "ADMIN" || role === "SUPER_ADMIN") {
      await withRetry(() =>
        prisma.adminProfile.create({
          data: {
            userId: user.id,
            adminLevel:
              role === "SUPER_ADMIN" ? AdminLevel.SUPER : AdminLevel.NORMAL,
            assignedDepartments: [],
            allowedCategories: [],
          },
        }),
      );
    }

    res.status(201).json({
      message: "Registration successful. Waiting for approval.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        userID: user.userID,
        university: user.university,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Check if it's a Prisma connection error
    if (error instanceof Error && error.message.includes("ETIMEDOUT")) {
      res.status(503).json({
        error:
          "Database connection timeout. The database might be unavailable or sleeping. Please try again in a moment.",
      });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

// 2. Login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // NOTE: never log req.body here — it contains the plaintext password.
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Find user with retry logic
    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          userID: true,
          university: true,
          role: true,
          approvalStatus: true,
          // CC-60: presence decides whether a second factor is required.
          faceDescriptorEnc: true,
          // CC-64: an erased account must not be reachable.
          erasedAt: true,
        },
      }),
    );

    if (!user) {
      // Generic message: distinguishing "no such email" from "wrong password"
      // lets an attacker enumerate registered accounts.
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Check approval status
    if (user.approvalStatus !== ApprovalStatus.APPROVED) {
      // Temporarily allow login for pending users
      // res.status(403).json({
      //   error: "Account not approved yet",
      //   approvalStatus: user.approvalStatus
      // });
      // return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // CC-64: erasure replaces the password with a non-hash, so bcrypt already
    // fails - but relying on that is relying on an implementation detail of
    // how the tombstone happens to be written. This is the explicit check.
    if (user.erasedAt) {
      res.status(403).json({
        error: "This account has been erased and cannot be used.",
      });
      return;
    }

    // CC-60: face is the SECOND factor. A user who has enrolled one gets a
    // challenge instead of a session - no token is issued on this response.
    //
    // The gate is the enrolled template, not a separate preference flag:
    // enrolling IS opting in, and a second factor that can be skipped is not
    // one. DELETE /api/auth/face-descriptor is the way back out.
    if (FACE_LOGIN_ENABLED && user.faceDescriptorEnc) {
      const challenge = await issueFaceChallenge(user.id);

      res.json({
        requiresFace: true,
        challengeId: challenge.challengeId,
        nonce: challenge.nonce,
        expiresInSeconds: challenge.expiresInSeconds,
      });
      return;
    }

    // Update user status to active with retry
    await withRetry(() =>
      prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
        select: {
          id: true,
        },
      }),
    );

    // Update last login for admin (only if profile exists)
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      const adminProfile = await withRetry(() =>
        prisma.adminProfile.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
          },
        }),
      );

      if (adminProfile) {
        await withRetry(() =>
          prisma.adminProfile.update({
            where: { userId: user.id },
            data: { lastLoginAt: new Date() },
            select: {
              id: true,
            },
          }),
        );
      }
    }

    // Generate JWT token
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

    res.json({
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
    });
  } catch (error) {
    console.error("Login error:", error);

    // Check if it's a Prisma connection error
    if (error instanceof Error && error.message.includes("ETIMEDOUT")) {
      res.status(503).json({
        error:
          "Database connection timeout. The database might be unavailable or sleeping. Please try again in a moment.",
      });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Get Logged-In User (JWT based)
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        userID: true,
        university: true,
        role: true,
        approvalStatus: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: true,
        facultyProfile: true,
        adminProfile: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 4. Logout
/**
 * Log out.
 *
 * Deliberately does NOT require a valid access token: an expired access token
 * is exactly the moment logout still needs to work. The refresh token in the
 * body is what actually ends the session.
 */
export const logout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: unknown };

    if (typeof refreshToken === "string" && refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    // Only flip isActive when we know who is asking; with an expired access
    // token we do not, and revoking the refresh token is the part that matters.
    if (req.user?.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { isActive: false },
      });
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Utility: Euclidean distance between two face descriptor vectors
function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - (b[i] ?? 0), 2), 0),
  );
}

// 5. Save Face Descriptor (called after registration while authenticated)
export const saveFaceDescriptor = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { descriptor } = req.body;

    if (!FACE_LOGIN_ENABLED) {
      // A template stored without a key would have to be stored in the clear.
      res.status(503).json({ error: "Face login is not configured." });
      return;
    }

    if (
      !descriptor ||
      !Array.isArray(descriptor) ||
      descriptor.length !== 128
    ) {
      res.status(400).json({
        error: "Invalid face descriptor. Must be a 128-element array.",
      });
      return;
    }

    // Validate all elements are numbers
    if (
      !descriptor.every((v: unknown) => typeof v === "number" && isFinite(v))
    ) {
      res
        .status(400)
        .json({ error: "Descriptor must contain only finite numbers." });
      return;
    }

    // CC-60: stored encrypted, and never as the plaintext Float[] again.
    // Biometric template data cannot be changed by its subject once leaked.
    await withRetry(() =>
      prisma.user.update({
        where: { id: req.user!.id },
        data: {
          faceDescriptorEnc: encryptDescriptor(descriptor),
          faceDescriptor: [],
        },
        select: { id: true },
      }),
    );

    res.json({
      message:
        "Face saved. You will be asked for it after your password from now on.",
    });
  } catch (error) {
    console.error("Save face descriptor error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Face verification - CC-60.
//
// The old 1:N `faceLogin` that used to live here is GONE, not deprecated. It
// was an unauthenticated endpoint that scanned every enrolled user and issued
// a full session to the nearest match. Keeping that behind a flag would have
// been the same vulnerability with extra steps.
//
// What replaces it only runs after a password has verified, matches 1:1
// against that one account, and requires several samples from separate
// moments. See docs/specs/CC-60-face-hardening.md.
export const faceVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!FACE_LOGIN_ENABLED) {
      res.status(503).json({ error: "Face login is not configured." });
      return;
    }

    const { challengeId, nonce, descriptors } = req.body as {
      challengeId?: unknown;
      nonce?: unknown;
      descriptors?: unknown;
    };

    if (typeof challengeId !== "string" || typeof nonce !== "string") {
      res.status(400).json({ error: "Challenge is required." });
      return;
    }

    if (
      !Array.isArray(descriptors) ||
      descriptors.length < FACE_REQUIRED_SAMPLES ||
      !descriptors.every(isValidDescriptor)
    ) {
      res.status(400).json({
        error: `Send at least ${FACE_REQUIRED_SAMPLES} valid face samples.`,
      });
      return;
    }

    const claim = await claimFaceChallenge(challengeId, nonce);

    if (!claim.ok || !claim.userId) {
      // One message for every failure. Telling the caller whether the
      // challenge expired, was consumed, or had the wrong nonce tells an
      // attacker which half of their guess was right.
      res.status(401).json({ error: "Face verification failed." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: claim.userId },
      select: {
        id: true,
        name: true,
        email: true,
        userID: true,
        university: true,
        role: true,
        approvalStatus: true,
        faceDescriptorEnc: true,
      },
    });

    if (!user?.faceDescriptorEnc) {
      res.status(401).json({ error: "Face verification failed." });
      return;
    }

    const template = decryptDescriptor(user.faceDescriptorEnc);
    const outcome = verifySamples(descriptors as number[][], template);

    if (!outcome.ok) {
      // Logged with the reason so a genuine user who keeps failing can be
      // diagnosed; the response still says nothing useful to an attacker.
      console.warn(
        `[CC-60] face verify rejected for ${user.id}: ${outcome.reason}`,
      );
      res.status(401).json({ error: "Face verification failed." });
      return;
    }

    await consumeFaceChallenge(challengeId);

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
      select: { id: true },
    });

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

    // CC-01b: a full session gets the revocable half too.
    const issuedRefresh = await issueRefreshToken(
      user.id,
      req.headers["user-agent"],
    );

    res.json({
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
    });
  } catch (error) {
    console.error("Face verify error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-60: un-enrol.
 *
 * The escape hatch for "I enrolled a face and now cannot present it". Requires
 * an existing session, so it does not help someone already locked out - for
 * them an admin clearing the template is the recovery path. Predictable
 * failure mode, so it gets a deliberate answer rather than a support ticket.
 */
export const deleteFaceDescriptor = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { faceDescriptorEnc: null, faceDescriptor: [] },
      select: { id: true },
    });

    // Any pending challenge is meaningless now.
    await prisma.faceChallenge.deleteMany({ where: { userId: req.user!.id } });

    // CC-61: deleting regulated personal data with no record of who asked or
    // when is the specific thing a data protection regime cares about. The
    // template itself is never in the metadata - see redact().
    await auditFromRequest(req, {
      action: AuditAction.FACE_CLEAR,
      targetType: "User",
      targetId: req.user!.id,
      summary: "Cleared own face template",
    });

    res.json({ message: "Face login disabled for your account." });
  } catch (error) {
    console.error("Delete face descriptor error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


/**
 * CC-01b: exchange a refresh token for a new access token.
 *
 * Rotates on every call, so a refresh token is valid exactly once. Presenting
 * an already-rotated token revokes the entire family — see
 * services/auth/refreshTokens.ts.
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: unknown };

    if (typeof refreshToken !== "string" || !refreshToken) {
      res.status(400).json({ error: "Refresh token is required" });
      return;
    }

    const result = await rotateRefreshToken(refreshToken);

    if (!result.ok) {
      // One generic message for every failure: distinguishing "expired" from
      // "reused" would tell an attacker whether a stolen token had been used.
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: {
        id: true,
        role: true,
        userID: true,
        university: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
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

    res.json({ token, refreshToken: result.token });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
