import { Router } from "express";
import { createFacultyProfile, getFacultyProfile, updateFacultyProfile } from "../controllers/facultyController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { Role } from "../generated/prisma/index.js";
const router = Router();
// 8. Create Faculty Profile
router.post("/", createFacultyProfile);
// 9. Get Faculty Profile
router.get("/me", authenticate, authorize(Role.FACULTY), getFacultyProfile);
// 10. Update Faculty Profile
router.put("/me", authenticate, authorize(Role.FACULTY), updateFacultyProfile);
export default router;
//# sourceMappingURL=faculty.js.map