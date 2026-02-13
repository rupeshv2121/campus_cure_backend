import { Router } from "express";
import { createStudentProfile, getStudentProfile, updateStudentProfile } from "../controllers/studentController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { Role } from "../generated/prisma/index.js";
const router = Router();
// 5. Create Student Profile (Called after basic registration)
router.post("/", createStudentProfile);
// 6. Get Student Profile
router.get("/me", authenticate, authorize(Role.STUDENT), getStudentProfile);
// 7. Update Student Profile
router.put("/me", authenticate, authorize(Role.STUDENT), updateStudentProfile);
export default router;
//# sourceMappingURL=students.js.map