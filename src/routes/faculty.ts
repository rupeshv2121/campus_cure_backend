import { Role } from "@prisma/client";
import { Router } from "express";
import {
  assignedComplaints,
  createFacultyProfile,
  deleteAnswer,
  editAnswer,
  getDoubtById,
  getDoubts,
  getFacultyProfile,
  getMyAnswers,
  postAnswer,
  updateFacultyProfile,
  verifyAnswer,
} from "../controllers/facultyController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 8. Create Faculty Profile
router.post("/", createFacultyProfile);

// 9. Get Faculty Profile
router.get("/me", authenticate, authorize(Role.FACULTY), getFacultyProfile);

// 10. Update Faculty Profile
router.put("/me", authenticate, authorize(Role.FACULTY), updateFacultyProfile);

// ========== DOUBTS ==========

// 11. Get all doubts
router.get("/doubts", authenticate, authorize(Role.FACULTY), getDoubts);

// 12. Get a single doubt by ID
router.get("/doubts/:id", authenticate, authorize(Role.FACULTY), getDoubtById);

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

// 16. Get faculty's answers
router.get("/answers/my", authenticate, authorize(Role.FACULTY), getMyAnswers);

export default router;

// 11. Get Complaints Assigned to Faculty
router.get(
  "/complaints",
  authenticate,
  authorize(Role.FACULTY),
  assignedComplaints,
);
