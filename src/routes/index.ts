import { Router } from "express";
import adminRoutes from "./admin.js";
import chatRoutes from "./chat.js";
import authRoutes from "./auth.js";
import facultyRoutes from "./faculty.js";
import internalRoutes from "./internal.js";
import notificationRoutes from "./notifications.js";
import studentRoutes from "./students.js";
import staffRoutes from "./staff.js";
import privacyRoutes from "./privacy.js";
import reputationRoutes from "./reputation.js";
import {
  telegramLinkRouter,
  telegramWebhookRouter,
} from "./telegram.js";
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
// CC-25: reputation, rank and the leaderboard.
router.use("/api/reputation", reputationRoutes);
// CC-42: linking is per-user and authenticated; the webhook is public and
// guarded by Telegram's secret token header instead.
router.use("/api/me", telegramLinkRouter);
router.use("/api/telegram", telegramWebhookRouter);
// CC-02: signing an upload, and reading a file back through a signed URL.
// CC-27: readable by every authenticated role, not just faculty.
router.use("/api/staff", staffRoutes);

router.use("/api/uploads", uploadsRouter);
router.use("/api/attachments", attachmentsRouter);
// Machine-to-machine; guarded by a shared secret, not user auth.
router.use("/api/internal", internalRoutes);

export default router;
