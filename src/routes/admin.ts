import { Role } from "@prisma/client";
import { Router } from "express";
import {
  approveUser,
  getAuditLog,
  assignComplaint,
  getAdminProfile,
  getAllComplaints,
  getComplaintDuplicateClusters,
  getAllFacultyDebug,
  getAllUsers,
  getAnalytics,
  getApprovedFaculty,
  getAssignmentCandidates,
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

// CC-13: likely-duplicate clusters among open complaints. Read-only.
router.get(
  "/complaints/duplicates",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getComplaintDuplicateClusters,
);

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

// CC-01 follow-up (2026-09-23): the unauthenticated `POST /` profile-creation
// route that lived here has been REMOVED.
//
// It was dead code. `authController.register` creates the matching profile
// itself for every role, so this endpoint's own "profile already exists" check
// rejected every real call - the frontend never invoked it.
//
// It was also the wrong kind of dead code: unauthenticated, taking `userId`
// from the request body, and writing permission fields straight from that body.
// Registration creates the user and the profile in two separate awaited steps
// rather than one transaction, so a failure in between leaves a PENDING
// privileged user with no profile - exactly the window in which this endpoint
// would have let an unauthenticated caller choose that user's permissions.
//
// Profiles are created at registration and edited through the authenticated
// update routes below.


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
  getComplaintDuplicateClusters,
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

/**
 * CC-61: the audit trail. SUPER_ADMIN only - most entries are about admin
 * behaviour, and a trail the audited party can read is one they can learn to
 * work around.
 */
router.get(
  "/audit-log",
  authenticate,
  authorize(Role.SUPER_ADMIN),
  getAuditLog,
);

// CC-27: ranked candidates for one complaint. Registered on its own path
// rather than replacing getApprovedFaculty, which other screens still use for
// plain "list the faculty" purposes.
router.get(
  "/complaints/:complaintId/candidates",
  authenticate,
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAssignmentCandidates,
);

export default router;
