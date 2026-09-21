import { Router } from "express";
import adminRoutes from "./admin.js";
import chatRoutes from "./chat.js";
import authRoutes from "./auth.js";
import facultyRoutes from "./faculty.js";
import internalRoutes from "./internal.js";
import notificationRoutes from "./notifications.js";
import studentRoutes from "./students.js";
import privacyRoutes from "./privacy.js";
import { attachmentsRouter, uploadsRouter } from "./uploads.js";

const router = Router();

// Mount routes
router.use("/api/auth", authRoutes);
router.use("/api/students", studentRoutes);
router.use("/api/faculty", facultyRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/chat", chatRoutes);
router.use("/api/notifications", notificationRoutes);
// CC-64: consent, export and erasure. Always the caller's own data.
router.use("/api/me", privacyRoutes);
// CC-02: signing an upload, and reading a file back through a signed URL.
router.use("/api/uploads", uploadsRouter);
router.use("/api/attachments", attachmentsRouter);
// Machine-to-machine; guarded by a shared secret, not user auth.
router.use("/api/internal", internalRoutes);

export default router;
