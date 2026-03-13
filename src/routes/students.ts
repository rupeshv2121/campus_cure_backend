import { Router } from "express";
import {
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
  getStudentProfile,
  markAnswerAsAccepted,
  postAnswer,
  postDoubt,
  raiseComplaint,
  updateStudentProfile,
  upvoteAnswer,
} from "../controllers/studentController.js";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 5. Create Student Profile (Called after basic registration)
router.post("/", createStudentProfile);

// 6. Get Student Profile
router.get("/me", authenticate, authorize(Role.STUDENT), getStudentProfile);

// 7. Update Student Profile
router.put("/me", authenticate, authorize(Role.STUDENT), updateStudentProfile);

// ========== COMPLAINTS ==========

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

// 12. Get student's own doubts
router.get("/doubts/my", authenticate, authorize(Role.STUDENT), getMyDoubts);

// 13. Get a single doubt by ID
router.get("/doubts/:id", authenticate, authorize(Role.STUDENT), getDoubtById);

// 14. Edit a doubt
router.put("/doubts/:id", authenticate, authorize(Role.STUDENT), editDoubt);

// 15. Delete a doubt
router.delete("/doubts/:id", authenticate, authorize(Role.STUDENT), deleteDoubt);

// ========== ANSWERS ==========

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

// 18. Post an answer to a doubt
router.post(
  "/doubts/:doubtId/answers",
  authenticate,
  authorize(Role.STUDENT),
  postAnswer,
);

// 19. Edit an answer
router.put("/answers/:answerId", authenticate, authorize(Role.STUDENT), editAnswer);

// 19b. Delete an answer
router.delete("/answers/:answerId", authenticate, authorize(Role.STUDENT), deleteAnswer);

// 20. Get student's own answers
router.get("/answers/my", authenticate, authorize(Role.STUDENT), getMyAnswers);

// 21. Get student's own answer for a specific doubt
router.get(
  "/doubts/:doubtId/my-answer",
  authenticate,
  authorize(Role.STUDENT),
  getMyAnswerForDoubt,
);

export default router;
