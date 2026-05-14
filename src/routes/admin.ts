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

// 1. Get Pending Students (Admin)
router.get(
  "/pending/students",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getPendingStudents,
);

// 2. Get Pending Faculty (Admin)
router.get(
  "/pending/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getPendingFaculty,
);

// 3. Create Admin Profile
router.post("/", createAdminProfile);

// 4. Get Admin Profile
router.get(
  "/me",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAdminProfile,
);

// 5. Update Admin Profile
router.put(
  "/me",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateAdminProfile,
);

// 6. Super Admin: System-wide stats
router.get(
  "/super/stats",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getSuperAdminStats,
);

// 7. Super Admin: Get system settings
router.get(
  "/super/settings",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getSuperAdminSettings,
);

// 8. Super Admin: Update system settings
router.put(
  "/super/settings",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  updateSuperAdminSettings,
);

// 9. Super Admin: Update another admin's permissions
router.put(
  "/permissions/:adminProfileId",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  updateAdminPermissions,
);

// 10. Get Pending Admins (Super Admin)
router.get(
  "/pending/admins",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getPendingAdmins,
);

// 11. Approve User
router.put(
  "/approve/:userId",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  approveUser,
);

// 12. Reject User
router.put(
  "/reject/:userId",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  rejectUser,
);

// 13. Get Dashboard Stats
router.get(
  "/dashboard",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getDashboardStats,
);

// 14. Get Analytics
router.get(
  "/analytics",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAnalytics,
);

// 15. Get All Complaints (Admin)
router.get(
  "/complaints",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllComplaints,
);

// 16. Get Approved Faculty (Admin)
router.get(
  "/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getApprovedFaculty,
);

// 17. Assign Complaint (Admin)
router.post(
  "/complaints/assign",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  assignComplaint,
);

// 18. Get User Details
router.get(
  "/users",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllUsers,
);

// 19. Update Complaint Status (Admin)
router.put(
  "/complaints/status",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateComplaintStatus,
);

// 20. Toggle User Active Status
router.put(
  "/users/:userId/active",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  toggleUserActiveStatus,
);

// 21. Update User Approval Status
router.put(
  "/users/:userId/approval",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  updateUserApprovalStatus,
);

// 22. Debug: Get all faculty for troubleshooting
router.get(
  "/debug/faculty",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAllFacultyDebug,
);

// ============ SUPER ADMIN COMPLAINT ESCALATION ROUTES ============

// 23. Get Escalated Complaints (Super Admin Only)
router.get(
  "/complaints/escalated",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getEscalatedComplaints,
);

// 24. Reassign Escalated Complaint (Super Admin Only)
router.post(
  "/complaints/escalated/reassign",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  reassignEscalatedComplaint,
);

// 25. Mark Complaint as Handled by Super Admin
router.post(
  "/complaints/escalated/mark-handled",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  markComplaintAsHandled,
);

export default router;
