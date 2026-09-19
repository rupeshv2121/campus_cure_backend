import { AdminLevel, ApprovalStatus, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, prisma } from "../config/database.js";
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
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful",
      token,
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
export const logout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Update user status to inactive
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { isActive: false },
    });

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

    await withRetry(() =>
      prisma.user.update({
        where: { id: req.user!.id },
        data: { faceDescriptor: descriptor },
      }),
    );

    res.json({ message: "Face descriptor saved successfully." });
  } catch (error) {
    console.error("Save face descriptor error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Face Login
export const faceLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { descriptor } = req.body;

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

    if (
      !descriptor.every((v: unknown) => typeof v === "number" && isFinite(v))
    ) {
      res
        .status(400)
        .json({ error: "Descriptor must contain only finite numbers." });
      return;
    }

    // Fetch all users that have a face descriptor registered
    const users = await withRetry(() =>
      prisma.user.findMany({
        where: {
          NOT: { faceDescriptor: { isEmpty: true } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          userID: true,
          university: true,
          role: true,
          approvalStatus: true,
          isActive: true,
          faceDescriptor: true,
        },
      }),
    );

    if (users.length === 0) {
      res.status(401).json({
        error: "No registered face found. Please register your face first.",
      });
      return;
    }

    // Find best matching user
    let bestMatch: (typeof users)[0] | null = null;
    let bestDistance = Infinity;

    for (const user of users) {
      if (user.faceDescriptor.length !== 128) continue;
      const distance = euclideanDistance(descriptor, user.faceDescriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = user;
      }
    }

    const MATCH_THRESHOLD = 0.6;

    if (!bestMatch || bestDistance >= MATCH_THRESHOLD) {
      res.status(401).json({
        error: "Face not recognized. Please try again or use password login.",
      });
      return;
    }

    // Note: approval check is intentionally skipped here to match the
    // behaviour of password login (pending users are allowed to authenticate).
    // Enforce access restrictions at the protected-route level instead.

    // Mark user as active (required so the authenticate middleware doesn't reject the token)
    await withRetry(() =>
      prisma.user.update({
        where: { id: bestMatch!.id },
        data: { isActive: true },
      }),
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: bestMatch.id,
        role: bestMatch.role,
        userID: bestMatch.userID,
        university: bestMatch.university,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Face login successful",
      token,
      user: {
        id: bestMatch.id,
        name: bestMatch.name,
        email: bestMatch.email,
        userID: bestMatch.userID,
        university: bestMatch.university,
        role: bestMatch.role,
        approvalStatus: bestMatch.approvalStatus,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("Face login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
