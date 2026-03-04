import { Router } from "express";
import { assignedComplaints, createFacultyProfile, getFacultyProfile, updateFacultyProfile, } from "../controllers/facultyController.js";
import { Role } from "../generated/prisma/index.js";
import { authenticate, authorize } from "../middleware/auth.js";
const router = Router();
// 8. Create Faculty Profile
router.post("/", createFacultyProfile);
// 9. Get Faculty Profile
router.get("/me", authenticate, authorize(Role.FACULTY), getFacultyProfile);
// 10. Update Faculty Profile
router.put("/me", authenticate, authorize(Role.FACULTY), updateFacultyProfile);
// 11. Get Complaints Assigned to Faculty
router.get("/complaints", authenticate, authorize(Role.FACULTY), assignedComplaints);
export default router;
//# sourceMappingURL=faculty.js.map