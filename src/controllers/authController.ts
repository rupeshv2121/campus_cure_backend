import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, prisma } from "../config/database.js";
import { AdminLevel, ApprovalStatus, Role } from "../generated/prisma/index.js";
import type { AuthRequest } from "../types/index.js";
import { withRetry } from "../utils/retry.js";

// 1. Register (Student / Faculty / Admin)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, username } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role || !username) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    // Validate role
    if (!["STUDENT", "FACULTY", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    // Check if user already exists
    const existingUser = await withRetry(() =>
      prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      }),
    );

    if (existingUser) {
      res
        .status(400)
        .json({ error: "User with this email or username already exists" });
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
          username,
          role: role as Role,
          approvalStatus: ApprovalStatus.PENDING,
          isActive: false,
        },
      }),
    );

    // Create corresponding profile based on role
    if (role === "STUDENT") {
      await withRetry(() =>
        prisma.studentProfile.create({
          data: {
            userId: user.id,
            enrollmentNumber: username,
            department: "Not Set",
            branch: "Not Set",
            semester: 1,
            phoneNumber: 0,
            address: "Not Set",
            guardianName: "Not Set",
            guardianPhone: "Not Set",
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
        username: user.username,
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
    console.log("Login request received:", req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Find user with retry logic
    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { email },
      }),
    );

    console.log(
      "User found:",
      user
        ? {
            id: user.id,
            email: user.email,
            approvalStatus: user.approvalStatus,
          }
        : null,
    );

    if (!user) {
      res.status(401).json({ error: "Invalid email" });
      return;
    }

    // Check approval status
    if (user.approvalStatus !== ApprovalStatus.APPROVED) {
      console.log("User approval status:", user.approvalStatus);
      // Temporarily allow login for pending users
      // res.status(403).json({
      //   error: "Account not approved yet",
      //   approvalStatus: user.approvalStatus
      // });
      // return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    // Update user status to active with retry
    await withRetry(() =>
      prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      }),
    );

    // Update last login for admin (only if profile exists)
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      const adminProfile = await withRetry(() =>
        prisma.adminProfile.findUnique({
          where: { userId: user.id },
        }),
      );

      if (adminProfile) {
        await withRetry(() =>
          prisma.adminProfile.update({
            where: { userId: user.id },
            data: { lastLoginAt: new Date() },
          }),
        );
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
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
        username: user.username,
        role: user.role,
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
        username: true,
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
