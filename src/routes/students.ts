import { Router } from "express";
import {
  createStudentProfile,
  getComplaints,
  getStudentProfile,
  raiseComplaint,
  updateStudentProfile,
} from "../controllers/studentController.js";
import { Role } from "../generated/prisma/index.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// 5. Create Student Profile (Called after basic registration)
router.post("/", createStudentProfile);

// 6. Get Student Profile
router.get("/me", authenticate, authorize(Role.STUDENT), getStudentProfile);

// 7. Update Student Profile
router.put("/me", authenticate, authorize(Role.STUDENT), updateStudentProfile);

// 8. Raise Complaint
router.post(
  "/complaints/new",
  authenticate,
  authorize(Role.STUDENT),
  raiseComplaint,
);

// 9. Get All Complaints for student
router.get("/complaints", authenticate, authorize(Role.STUDENT), getComplaints);

export default router;
