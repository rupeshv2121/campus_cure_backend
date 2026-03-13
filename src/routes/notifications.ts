import express from "express";
import { authenticate } from "../middleware/auth.js";
import type { AuthRequest } from "../types/index.js";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../utils/notifications.js";

const router = express.Router();

// Get user notifications
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;

    console.log(`API: Getting notifications for user ${userId}`);
    const notifications = await getUserNotifications(userId, limit);
    console.log(`API: Sending ${notifications.length} notifications`);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
});

// Get unread count
router.get("/unread-count", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const count = await getUnreadNotificationCount(userId);
    res.json({ success: true, count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch unread count" });
  }
});

// Mark notification as read
router.patch("/:id/read", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = req.params.id;

    if (!notificationId || typeof notificationId !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid notification ID" });
      return;
    }

    await markNotificationAsRead(notificationId, userId);
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update notification" });
  }
});

// Mark all notifications as read
router.patch("/mark-all-read", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    await markAllNotificationsAsRead(userId);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update notifications" });
  }
});

// Test endpoint for creating notifications (development/debugging)
router.post("/test", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { createNotification } = await import("../utils/notifications.js");

    await createNotification({
      userId,
      type: "GENERAL",
      title: "Test Notification",
      message: "This is a test notification created for debugging purposes.",
      data: { test: true },
    });

    res.json({ success: true, message: "Test notification created" });
  } catch (error) {
    console.error("Error creating test notification:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create test notification" });
  }
});

export default router;
