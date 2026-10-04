/**
 * Student profile and posting settings.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  Prisma,
  Role
} from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import type { AuthRequest } from "../../types/index.js";
import { getPostingSettings, isTenDigitPhoneNumber } from "./shared.js";

// 7b. Get posting settings for students
export const getStudentPostingSettings = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const settings = await getPostingSettings();
    res.json({ settings });
  } catch (error) {
    console.error("Get student posting settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 5. Create Student Profile (Called after basic registration)
export const createStudentProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      userId,
      enrollmentNumber,
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
    } = req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.STUDENT) {
      res.status(400).json({ error: "User is not a student" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Student profile already exists" });
      return;
    }

    const profile = await prisma.studentProfile.create({
      data: {
        userId,
        enrollmentNumber: enrollmentNumber || user.userID,
        department: department || "",
        branch: branch || "",
        semester: semester || 1,
        phoneNumber: phoneNumber || 0,
        address: address || "",
        isStudying:
          req.body.isStudying !== undefined ? req.body.isStudying : true,
        guardianName: guardianName || "",
        guardianPhone: guardianPhone || "",
        doubtsAsked: 0,
        doubtsSolved: 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Student profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Get Student Profile
export const getStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userID: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 7. Update Student Profile
export const updateStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
    } = req.body;

    const data: {
      department?: string;
      branch?: string;
      semester?: number;
      phoneNumber?: string;
      address?: string;
      guardianName?: string;
      guardianPhone?: string;
    } = {};

    if (department !== undefined) {
      data.department = String(department).trim();
    }

    if (branch !== undefined) {
      data.branch = String(branch).trim();
    }

    if (semester !== undefined) {
      const parsedSemester = Number(semester);

      if (
        !Number.isInteger(parsedSemester) ||
        parsedSemester < 1 ||
        parsedSemester > 8
      ) {
        res
          .status(400)
          .json({ error: "Semester must be an integer between 1 and 8" });
        return;
      }

      data.semester = parsedSemester;
    }

    if (phoneNumber !== undefined) {
      const normalizedPhoneNumber = String(phoneNumber).trim();
      if (
        normalizedPhoneNumber.length > 0 &&
        !isTenDigitPhoneNumber(normalizedPhoneNumber)
      ) {
        res
          .status(400)
          .json({ error: "Phone number must be exactly 10 digits" });
        return;
      }

      data.phoneNumber = normalizedPhoneNumber;
    }

    if (address !== undefined) {
      data.address = String(address).trim();
    }

    if (guardianName !== undefined) {
      data.guardianName = String(guardianName).trim();
    }

    if (guardianPhone !== undefined) {
      const normalizedGuardianPhone = String(guardianPhone).trim();
      if (
        normalizedGuardianPhone.length > 0 &&
        !isTenDigitPhoneNumber(normalizedGuardianPhone)
      ) {
        res
          .status(400)
          .json({ error: "Guardian phone number must be exactly 10 digits" });
        return;
      }

      data.guardianPhone = normalizedGuardianPhone;
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No valid fields provided for update" });
      return;
    }

    const profile = await prisma.studentProfile.update({
      where: { userId: req.user!.id },
      data,
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    console.error("Update student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
