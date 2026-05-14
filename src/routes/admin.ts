import { Role } from "@prisma/client";
import { Router } from "express";
import {
  approveUser,
  assignComplaint,
  createAdminProfile,
  getAdminProfile,
  getAllComplaints,
  getAllFacultyDebug,
  getAllUsers,
  getAnalytics,
  getApprovedFaculty,
  getDashboardStats,
  getEscalatedComplaints,
  getPendingAdmins,
  getPendingFaculty,
  getPendingStudents,
  getSuperAdminSettings,
  getSuperAdminStats,
  markComplaintAsHandled,
  reassignEscalatedComplaint,
  rejectUser,
  toggleUserActiveStatus,
  updateAdminPermissions,
  updateAdminProfile,
  updateComplaintStatus,
  updateSuperAdminSettings,
  updateUserApprovalStatus,
} from "../controllers/adminController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 11. Get Pending Students (Admin)
router.get(
  "/pending/students",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getPendingStudents,
);

// 12. Get Pending Faculty (Admin)
router.get(
  "/pending/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getPendingFaculty,
);

// 13. Create Admin Profile
router.post("/", createAdminProfile);

// Get Admin Profile
router.get(
  "/me",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAdminProfile,
);

// Update Admin Profile
router.put(
  "/me",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateAdminProfile,
);

// Super Admin: System-wide stats
router.get(
  "/super/stats",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getSuperAdminStats,
);

// Super Admin: Get system settings
router.get(
  "/super/settings",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getSuperAdminSettings,
);

// Super Admin: Update system settings
router.put(
  "/super/settings",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  updateSuperAdminSettings,
);

// Super Admin: Update another admin's permissions
router.put(
  "/permissions/:adminProfileId",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  updateAdminPermissions,
);

// 14. Get Pending Admins (Super Admin)
router.get(
  "/pending/admins",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getPendingAdmins,
);

// 15. Approve User
router.put(
  "/approve/:userId",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  approveUser,
);

// 16. Reject User
router.put(
  "/reject/:userId",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  rejectUser,
);

// 17. Get Dashboard Stats
router.get(
  "/dashboard",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getDashboardStats,
);

// 18. Get Analytics
router.get(
  "/analytics",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAnalytics,
);

// 19. Get All Complaints (Admin)
router.get(
  "/complaints",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllComplaints,
);

// 20. Get Approved Faculty (Admin)
router.get(
  "/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getApprovedFaculty,
);

// 21. Assign Complaint (Admin)
router.post(
  "/complaints/assign",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  assignComplaint,
);

// 22. Get User Details
router.get(
  "/users",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllUsers,
);

// 23. Update Complaint Status (Admin)
router.put(
  "/complaints/status",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateComplaintStatus,
);

// 24. Toggle User Active Status
router.put(
  "/users/:userId/active",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  toggleUserActiveStatus,
);

// 25. Update User Approval Status
router.put(
  "/users/:userId/approval",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateUserApprovalStatus,
);

// Debug: Get all faculty for troubleshooting
router.get(
  "/debug/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllFacultyDebug,
);

// ============ SUPER ADMIN COMPLAINT ESCALATION ROUTES ============

// Get Escalated Complaints (Super Admin Only)
router.get(
  "/complaints/escalated",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getEscalatedComplaints,
);

// Reassign Escalated Complaint (Super Admin Only)
router.post(
  "/complaints/escalated/reassign",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  reassignEscalatedComplaint,
);

// Mark Complaint as Handled by Super Admin
router.post(
  "/complaints/escalated/mark-handled",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  markComplaintAsHandled,
);

export default router;
