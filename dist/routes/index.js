import { Router } from "express";
import authRoutes from "./auth.js";
import studentRoutes from "./students.js";
import facultyRoutes from "./faculty.js";
import adminRoutes from "./admin.js";
const router = Router();
// Mount routes
router.use("/api/auth", authRoutes);
router.use("/api/students", studentRoutes);
router.use("/api/faculty", facultyRoutes);
router.use("/api/admin", adminRoutes);
export default router;
//# sourceMappingURL=index.js.map