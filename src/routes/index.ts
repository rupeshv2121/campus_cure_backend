import { Router } from "express";
import adminRoutes from "./admin.js";
import authRoutes from "./auth.js";
import facultyRoutes from "./faculty.js";
import notificationRoutes from "./notifications.js";
import studentRoutes from "./students.js";

const router = Router();

// Mount routes
router.use("/api/auth", authRoutes);
router.use("/api/students", studentRoutes);
router.use("/api/faculty", facultyRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/notifications", notificationRoutes);

export default router;
