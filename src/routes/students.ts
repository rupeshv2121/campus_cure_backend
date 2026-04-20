import { Role } from "@prisma/client";
import { Router } from "express";
import {
  confirmComplaintResolution,
  createStudentProfile,
  deleteAnswer,
  deleteDoubt,
  editAnswer,
  editDoubt,
  getComplaints,
  getDoubtById,
  getDoubts,
  getMyAnswerForDoubt,
  getMyAnswers,
  getMyDoubts,
  getSimilarDoubtSuggestions,
  getStudentPostingSettings,
  getStudentProfile,
  getSubjectWiseDoubtsAnalytics,
  markAnswerAsAccepted,
  postAnswer,
  postDoubt,
  raiseComplaint,
  rejectComplaintResolution,
  submitComplaintFeedback,
  updateStudentProfile,
  upvoteAnswer,
  upvoteDoubt,
} from "../controllers/studentController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 5. Create Student Profile (Called after basic registration)
router.post("/", createStudentProfile);

// 6. Get Student Profile
router.get("/me", authenticate, authorize(Role.STUDENT), getStudentProfile);

// 7. Update Student Profile
router.put("/me", authenticate, authorize(Role.STUDENT), updateStudentProfile);

// ========== COMPLAINTS ==========

// 7b. Get posting settings
router.get(
  "/settings/posting",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  getStudentPostingSettings,
);

// 8. Raise Complaint
router.post(
  "/complaints/new",
  authenticate,
  authorize(Role.STUDENT),
  raiseComplaint,
);

// 9. Get All Complaints for student
router.get("/complaints", authenticate, authorize(Role.STUDENT), getComplaints);

// ========== DOUBTS ==========

// 10. Post a new doubt
router.post("/doubts", authenticate, authorize(Role.STUDENT), postDoubt);

// 11. Get all doubts with filters
router.get("/doubts", authenticate, authorize(Role.STUDENT), getDoubts);

// 11a. Get similar doubt suggestions
router.get(
  "/doubts/suggestions",
  authenticate,
  authorize(Role.STUDENT),
  getSimilarDoubtSuggestions,
);

// 11b. Get SubjectWise doubts analytics
router.get(
  "/doubts/analytics/subjectwise",
  authenticate,
  authorize(Role.STUDENT),
  getSubjectWiseDoubtsAnalytics,
);

// 12. Get student's own doubts
router.get("/doubts/my", authenticate, authorize(Role.STUDENT), getMyDoubts);

// 13. Get a single doubt by ID
router.get("/doubts/:id", authenticate, authorize(Role.STUDENT), getDoubtById);

// 14. Edit a doubt
router.put("/doubts/:id", authenticate, authorize(Role.STUDENT), editDoubt);

// 15. Delete a doubt
router.delete(
  "/doubts/:id",
  authenticate,
  authorize(Role.STUDENT),
  deleteDoubt,
);

// ========== ANSWERS ==========

// 16a. Post an answer (student answers go to faculty moderation)
router.post(
  "/doubts/:doubtId/answers",
  authenticate,
  authorize(Role.STUDENT),
  postAnswer,
);

// 16. Mark an answer as accepted
router.post(
  "/doubts/:doubtId/answers/:answerId/accept",
  authenticate,
  authorize(Role.STUDENT),
  markAnswerAsAccepted,
);

// 17. Upvote an answer
router.post(
  "/answers/:answerId/upvote",
  authenticate,
  authorize(Role.STUDENT),
  upvoteAnswer,
);

// 17a. Upvote a doubt (student/faculty)
router.post(
  "/doubts/:doubtId/upvote",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  upvoteDoubt,
);

// 17b. Edit own answer (allowed only while pending moderation)
router.put(
  "/answers/:answerId",
  authenticate,
  authorize(Role.STUDENT),
  editAnswer,
);

// 17c. Delete own answer
router.delete(
  "/answers/:answerId",
  authenticate,
  authorize(Role.STUDENT),
  deleteAnswer,
);

// 20. Get student's own answers
router.get("/answers/my", authenticate, authorize(Role.STUDENT), getMyAnswers);

// 21. Get student's own answer for a specific doubt
router.get(
  "/doubts/:doubtId/my-answer",
  authenticate,
  authorize(Role.STUDENT),
  getMyAnswerForDoubt,
);

// ========== COMPLAINT CONFIRMATION ==========

// 22. Confirm complaint resolution
router.post(
  "/complaints/:complaintId/confirm-resolution",
  authenticate,
  authorize(Role.STUDENT),
  confirmComplaintResolution,
);

// 23. Reject complaint resolution
router.post(
  "/complaints/:complaintId/reject-resolution",
  authenticate,
  authorize(Role.STUDENT),
  rejectComplaintResolution,
);

// 24. Submit complaint feedback (after resolution)
router.post(
  "/complaints/:complaintId/feedback",
  authenticate,
  authorize(Role.STUDENT),
  submitComplaintFeedback,
);

export default router;
