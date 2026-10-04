import express from "express";
import { authenticate } from "../middleware/auth.js";
import { PUSH_ENABLED, VAPID_PUBLIC_KEY } from "../config/env.js";
import {
  PushError,
  removeSubscription,
  saveSubscription,
} from "../services/notify/push.js";
import type { AuthRequest } from "../types/index.js";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../utils/notifications.js";
import {
  unsubscribeByToken,
  unsubscribeTokenExists,
} from "../services/email/notificationEmail.js";
import { escapeHtml } from "../services/email/templates.js";

const router = express.Router();

/* ------------------------------------------------------------------ *
 * CC-40: unsubscribe
 *
 * Public by necessity - the link is clicked from an inbox, where there is no
 * session - and therefore keyed only by a random, unguessable token.
 *
 * GET IS INERT AND POST ACTS. Mail clients and security scanners prefetch
 * links; a GET that mutated would silently unsubscribe people who never
 * clicked. This is the reason for the confirmation page rather than a
 * one-click link.
 * ------------------------------------------------------------------ */

const page = (heading: string, body: string): string => `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CampusCure email preferences</title></head>
<body style="margin:0;padding:32px;background:#f6f7f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;">
  <div style="max-width:460px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">CampusCure</p>
    <h1 style="margin:0 0 12px;font-size:18px;">${heading}</h1>
    ${body}
  </div>
</body></html>`;

router.get("/unsubscribe/:token", async (req, res) => {
  const token = String(req.params.token ?? "");

  if (!(await unsubscribeTokenExists(token))) {
    res
      .status(404)
      .type("html")
      .send(page("Link not recognised", "<p style=\"margin:0;font-size:15px;line-height:1.6;\">This unsubscribe link is not valid. It may already have been used, or the address may have been removed.</p>"));
    return;
  }

  res
    .type("html")
    .send(
      page(
        "Stop notification emails?",
        `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">You will keep seeing notifications inside CampusCure. Only the emails stop.</p>
         <form method="POST" action="/api/notifications/unsubscribe/${escapeHtml(token)}">
           <button type="submit" style="background:#1677ff;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer;">Yes, stop the emails</button>
         </form>`,
      ),
    );
});

router.post("/unsubscribe/:token", async (req, res) => {
  const token = String(req.params.token ?? "");
  const done = await unsubscribeByToken(token);

  if (!done) {
    res.status(404).type("html").send(page("Link not recognised", "<p style=\"margin:0;font-size:15px;\">This unsubscribe link is not valid.</p>"));
    return;
  }

  res
    .type("html")
    .send(
      page(
        "Done",
        "<p style=\"margin:0;font-size:15px;line-height:1.6;\">You will not receive notification emails from CampusCure. Notifications still appear in the app, and you can turn emails back on from your profile.</p>",
      ),
    );
});

// Get user notifications
// CC-41: web push. The public key is not a secret - browsers need it to
// subscribe - but it is served behind authentication anyway, because only a
// signed-in user has anything to subscribe to.
router.get("/push/config", authenticate, (_req, res) => {
  res.json({ enabled: PUSH_ENABLED, publicKey: PUSH_ENABLED ? VAPID_PUBLIC_KEY : null });
});

router.post("/push/subscribe", authenticate, async (req: AuthRequest, res) => {
  try {
    await saveSubscription(
      req.user!.id,
      req.body?.subscription,
      req.headers["user-agent"],
    );
    res.status(201).json({ subscribed: true });
  } catch (error) {
    if (error instanceof PushError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("[CC-41] subscribe failed:", error);
    res.status(500).json({ error: "Could not turn on notifications." });
  }
});

router.post("/push/unsubscribe", authenticate, async (req: AuthRequest, res) => {
  try {
    const removed = await removeSubscription(req.user!.id, req.body?.endpoint);
    res.json({ removed });
  } catch (error) {
    console.error("[CC-41] unsubscribe failed:", error);
    res.status(500).json({ error: "Could not turn off notifications." });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    // Capped: the panel asks for at most 100, and an uncapped value let any
    // signed-in user ask the database for their entire history in one go.
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const notifications = await getUserNotifications(userId, limit);
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
