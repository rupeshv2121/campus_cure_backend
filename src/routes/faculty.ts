import { Role } from "@prisma/client";
import { Router } from "express";
import {
  assignedComplaints,
  deleteAnswer,
  editAnswer,
  getDoubtById,
  getDoubts,
  getFacultyProfile,
  getMyAnswers,
  approveAnswerDraft,
  getAnswerDraft,
  moderateAnswer,
  rejectAnswerDraft,
  requestAnswerDraft,
  postAnswer,
  updateComplaintStatus,
  updateFacultyProfile,
  upvoteDoubt,
  verifyAnswer,
} from "../controllers/facultyController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 8. Create Faculty Profile
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

// 9. Get Faculty Profile
router.get("/me", authenticate, authorize(Role.FACULTY), getFacultyProfile);

// 10. Update Faculty Profile
router.put("/me", authenticate, authorize(Role.FACULTY), updateFacultyProfile);

// ========== DOUBTS ==========

// 11. Get all doubts
router.get("/doubts", authenticate, authorize(Role.FACULTY), getDoubts);

// 12. Get a single doubt by ID
router.get("/doubts/:id", authenticate, authorize(Role.FACULTY), getDoubtById);

// CC-12: AI answer drafts. Faculty only - no student route reads AnswerDraft,
// so a draft cannot reach a student before a human approves it.
router.get(
  "/doubts/:id/draft",
  authenticate,
  authorize(Role.FACULTY),
  getAnswerDraft,
);
router.post(
  "/doubts/:id/draft/generate",
  authenticate,
  authorize(Role.FACULTY),
  requestAnswerDraft,
);
router.post(
  "/doubts/:id/draft/approve",
  authenticate,
  authorize(Role.FACULTY),
  approveAnswerDraft,
);
router.post(
  "/doubts/:id/draft/reject",
  authenticate,
  authorize(Role.FACULTY),
  rejectAnswerDraft,
);

// 12a. Upvote a doubt
router.post(
  "/doubts/:doubtId/upvote",
  authenticate,
  authorize(Role.FACULTY),
  upvoteDoubt,
);

// ========== ANSWERS ==========

// 13. Post an answer to a doubt
router.post(
  "/doubts/:doubtId/answers",
  authenticate,
  authorize(Role.FACULTY),
  postAnswer,
);

// 14. Edit an answer
router.put(
  "/answers/:answerId",
  authenticate,
  authorize(Role.FACULTY),
  editAnswer,
);

// 14b. Delete an answer
router.delete(
  "/answers/:answerId",
  authenticate,
  authorize(Role.FACULTY),
  deleteAnswer,
);

// 15. Verify an answer
router.post(
  "/answers/:answerId/verify",
  authenticate,
  authorize(Role.FACULTY),
  verifyAnswer,
);

// 15b. Moderate an answer
router.put(
  "/answers/:answerId/moderate",
  authenticate,
  authorize(Role.FACULTY),
  approveAnswerDraft,
  getAnswerDraft,
  moderateAnswer,
  rejectAnswerDraft,
  requestAnswerDraft,
);

// 16. Get faculty's answers
router.get("/answers/my", authenticate, authorize(Role.FACULTY), getMyAnswers);

// ========== COMPLAINTS ==========

// 17. Get Complaints Assigned to Faculty
router.get(
  "/complaints",
  authenticate,
  authorize(Role.FACULTY),
  assignedComplaints,
);

// 18. Update Complaint Status (Faculty only - IN_PROGRESS or PENDING_CONFIRMATION)
router.put(
  "/complaints/:complaintId/status",
  authenticate,
  authorize(Role.FACULTY),
  updateComplaintStatus,
);

export default router;
