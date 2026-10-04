/**
 * Faculty profiles and the staff directory.
 *
 * Split out of facultyController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  Prisma,
  Role
} from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../../config/database.js";
import {
  ROUTABLE_CATEGORIES,
  isRoutableCategory,
  listDirectory
} from "../../services/staff/routing.js";
import type { AuthRequest } from "../../types/index.js";
import { isTenDigitPhoneNumber } from "./shared.js";

// 1. Create Faculty Profile
export const createFacultyProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, department, branch, phoneNumber, address, subjects } =
      req.body;

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

    if (user.role !== Role.FACULTY) {
      res.status(400).json({ error: "User is not faculty" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.facultyProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Faculty profile already exists" });
      return;
    }

    const profile = await prisma.facultyProfile.create({
      data: {
        userId,
        department: department || "",
        branch: branch || "",
        phoneNumber: phoneNumber || "",
        address: address || "",
        isTeaching:
          req.body.isTeaching !== undefined ? req.body.isTeaching : true,
        subjects: subjects || [],
        doubtsSolved: 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Faculty profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 2. Get Faculty Profile
export const getFacultyProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.facultyProfile.findUnique({
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
      res.status(404).json({ error: "Faculty profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Update Faculty Profile
export const updateFacultyProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      department,
      branch,
      phoneNumber,
      address,
      subjects,
      isTeaching,
      // CC-27
      staffRole,
      handlesCategories,
      directoryOptIn,
    } = req.body;

    const data: {
      department?: string;
      branch?: string;
      phoneNumber?: string;
      address?: string;
      subjects?: string[];
      isTeaching?: boolean;
      staffRole?: string | null;
      handlesCategories?: string[];
      directoryOptIn?: boolean;
    } = {};

    if (department !== undefined) {
      data.department = String(department).trim();
    }

    if (branch !== undefined) {
      data.branch = String(branch).trim();
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

    if (subjects !== undefined) {
      if (Array.isArray(subjects)) {
        data.subjects = subjects
          .map((subject) => String(subject).trim())
          .filter((subject) => subject.length > 0);
      } else if (typeof subjects === "string") {
        data.subjects = subjects
          .split(",")
          .map((subject) => subject.trim())
          .filter((subject) => subject.length > 0);
      } else {
        res.status(400).json({
          error: "Subjects must be an array or comma-separated string",
        });
        return;
      }
    }

    if (isTeaching !== undefined) {
      if (typeof isTeaching === "boolean") {
        data.isTeaching = isTeaching;
      } else if (isTeaching === "true" || isTeaching === "false") {
        data.isTeaching = isTeaching === "true";
      } else {
        res.status(400).json({ error: "isTeaching must be a boolean" });
        return;
      }
    }

    // CC-27: what this person is. Display only - routing never reads it,
    // because free text cannot be checked.
    if (staffRole !== undefined) {
      const trimmed = String(staffRole).trim().slice(0, 80);
      data.staffRole = trimmed.length > 0 ? trimmed : null;
    }

    // CC-27: what this person actually handles. THE routing field, so unlike
    // staffRole every value is validated against CC-14's vocabulary - an
    // unrecognised category here would be a silent routing dead end, matching
    // nothing and explaining nothing.
    if (handlesCategories !== undefined) {
      if (!Array.isArray(handlesCategories)) {
        res
          .status(400)
          .json({ error: "handlesCategories must be an array" });
        return;
      }

      const normalized = [
        ...new Set(handlesCategories.map((entry) => String(entry).trim().toUpperCase())),
      ];
      const unknown = normalized.filter((entry) => !isRoutableCategory(entry));

      if (unknown.length > 0) {
        res.status(400).json({
          error:
            `Unknown complaint categories: ${unknown.join(", ")}. ` +
            `Allowed: ${ROUTABLE_CATEGORIES.join(", ")}`,
        });
        return;
      }

      data.handlesCategories = normalized;
    }

    // CC-27: consent, and only the subject may give it. There is no admin
    // route that sets this for someone else - that is the whole difference
    // between a staff directory and the student people-finder the roadmap cut.
    if (directoryOptIn !== undefined) {
      if (typeof directoryOptIn === "boolean") {
        data.directoryOptIn = directoryOptIn;
      } else if (directoryOptIn === "true" || directoryOptIn === "false") {
        data.directoryOptIn = directoryOptIn === "true";
      } else {
        res.status(400).json({ error: "directoryOptIn must be a boolean" });
        return;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No valid fields provided for update" });
      return;
    }

    const profile = await prisma.facultyProfile.update({
      where: { userId: req.user!.id },
      data,
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Faculty profile not found" });
      return;
    }

    console.error("Update faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-27: the staff directory.
 *
 * Readable by any authenticated member of the institution, because the point
 * is that a student with a flooded bathroom can find the plumber. Only
 * profiles that opted in appear at all — see listDirectory for why absence
 * beats redaction.
 */
export const getStaffDirectory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { category, teaching, q } = req.query;

    const entries = await listDirectory({
      category: typeof category === "string" ? category.toUpperCase() : null,
      teaching:
        teaching === "true" ? true : teaching === "false" ? false : null,
      query: typeof q === "string" && q.trim() ? q.trim().slice(0, 80) : null,
    });

    res.json({ staff: entries });
  } catch (error) {
    console.error("[CC-27] staff directory failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
