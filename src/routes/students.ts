import { Role } from "@prisma/client";
import { Router } from "express";
import {
  confirmComplaintResolution,
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
  getDoubtTags,
  bookmarkDoubt,
  unbookmarkDoubt,
  getBookmarkedDoubts,
  getStudentPostingSettings,
  getStudentProfile,
  getSubjectWiseDoubtsAnalytics,
  markAnswerAsAccepted,
  postAnswer,
  getSimilarComplaints,
  parseComplaint,
  postDoubt,
  raiseComplaint,
  readDoubtFromImage,
  rejectComplaintResolution,
  submitComplaintFeedback,
  updateStudentProfile,
  upvoteAnswer,
  upvoteDoubt,
} from "../controllers/studentController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";

const router = Router();

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

// CC-14: free text -> structured fields. Advisory; the student confirms.
router.post(
  "/complaints/parse",
  authenticate,
  authorize(Role.STUDENT),
  parseComplaint,
);

// CC-13: pre-submit duplicate check. Advisory only - never blocks filing.
// Registered before any /complaints/:param route so "similar" is not captured
// as a complaint id.
router.get(
  "/complaints/similar",
  authenticate,
  authorize(Role.STUDENT),
  getSimilarComplaints,
);

// ========== DOUBTS ==========

// 10. Post a new doubt
router.post("/doubts", authenticate, authorize(Role.STUDENT), postDoubt);

// CC-50: read a doubt out of an uploaded image. Advisory - it returns fields
// for the student to edit and submit themselves, never a posted doubt.
//
// NOTE: CC-12's isolation test asserts that its own feature name appears in
// no student route, which is how AI answer review is kept faculty-only. That
// check is a plain text match, so the word is avoided here on purpose -
// different feature, same vocabulary.
//
// Registered before any /doubts/:param route so "from-image" is not captured
// as a doubt id, matching the ordering note on /complaints/similar.
//
// Metered by chatLimiter rather than uploadLimiter: the expensive part is the
// vision completion, not the upload that preceded it, and a student who
// re-reads one image ten times costs ten completions.
router.post(
  "/doubts/from-image",
  authenticate,
  authorize(Role.STUDENT),
  chatLimiter,
  readDoubtFromImage,
);

// 11. Get all doubts with filters
router.get("/doubts", authenticate, authorize(Role.STUDENT), getDoubts);

// 11a. Get similar doubt suggestions
router.get(
  "/doubts/suggestions",
  authenticate,
  authorize(Role.STUDENT),
  getSimilarDoubtSuggestions,
  getDoubtTags,
  bookmarkDoubt,
  unbookmarkDoubt,
  getBookmarkedDoubts,
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

// CC-20: the tag vocabulary. Registered before /doubts/:id, or "tags" is
// captured as a doubt id - the same hazard called out for /complaints/similar.
router.get(
  "/doubts/tags",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  getDoubtTags,
);

// CC-21: the caller's saved doubts. Also registered before /doubts/:id.
router.get(
  "/doubts/bookmarked",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  getBookmarkedDoubts,
);

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

// CC-21: save / unsave a doubt. Both idempotent - this is a toggle behind a
// button students will double-tap on bad wifi. Same roles as upvoteDoubt.
router.post(
  "/doubts/:doubtId/bookmark",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  bookmarkDoubt,
);

router.delete(
  "/doubts/:doubtId/bookmark",
  authenticate,
  authorize(Role.STUDENT, Role.FACULTY),
  unbookmarkDoubt,
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
