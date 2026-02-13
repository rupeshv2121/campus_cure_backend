import { Router } from "express";
import {
  getPendingStudents,
  getPendingFaculty,
  createAdminProfile,
  getPendingAdmins,
  approveUser,
  rejectUser
} from "../controllers/adminController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { Role } from "../generated/prisma/index.js";

const router = Router();

// 11. Get Pending Students (Admin)
router.get("/pending/students", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), getPendingStudents);

// 12. Get Pending Faculty (Admin)
router.get("/pending/faculty", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), getPendingFaculty);

// 13. Create Admin Profile
router.post("/", createAdminProfile);

// 14. Get Pending Admins (Super Admin)
router.get("/pending/admins", authenticate, authorize(Role.SUPER_ADMIN), getPendingAdmins);

// 15. Approve User
router.put("/approve/:userId", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), approveUser);

// 16. Reject User
router.put("/reject/:userId", authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), rejectUser);

export default router;