/**
 * Notification email rendering (CC-40).
 *
 * One layout for every notification: what happened, a link to it, and how to
 * stop receiving these. A template system with a layout engine and brand
 * assets is not worth it for four emails.
 *
 * See docs/specs/CC-40-email-notifications.md.
 */

import { NotificationType } from "@prisma/client";
import { FRONTEND_URL, PUBLIC_API_URL } from "../../config/env.js";

/** Where a reader is sent to see the thing that happened. */
const APP_URL = FRONTEND_URL ?? "https://campus-cure-frontend.vercel.app";

/**
 * Where the unsubscribe link points.
 *
 * Deliberately NOT APP_URL: that route is served by the backend, and pointing
 * an emailed link at the frontend origin gives every recipient a 404.
 */
const API_URL = PUBLIC_API_URL.replace(/\/$/, "");

/**
 * Escape everything interpolated into the HTML body.
 *
 * Notification titles and messages embed user-supplied doubt and complaint
 * titles. This is the only place in the email path where that text becomes
 * markup, so it is the only place injection is possible - and the reason the
 * text alternative is built separately rather than by stripping tags.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export interface NotificationEmailInput {
  type: NotificationType;
  title: string;
  message: string;
  data?: unknown;
  unsubscribeToken: string;
  recipientName?: string | undefined;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Where a notification of this type should take the reader. */
const deepLink = (type: NotificationType, data: unknown): string => {
  const payload = (data ?? {}) as Record<string, unknown>;
  const doubtId = typeof payload.doubtId === "string" ? payload.doubtId : null;

  switch (type) {
    case NotificationType.COMPLAINT_STATUS_UPDATE:
      return `${APP_URL}/student/complaints`;
    case NotificationType.COMPLAINT_ASSIGNED:
      return `${APP_URL}/faculty/complaints`;
    case NotificationType.DOUBT_ANSWER:
    case NotificationType.DOUBT_ACCEPTED:
    case NotificationType.ANSWER_UPVOTED:
      return doubtId
        ? `${APP_URL}/student/doubts/${doubtId}`
        : `${APP_URL}/student/doubts`;
    default:
      return APP_URL;
  }
};

/** Label on the call-to-action, so it says what it does. */
const linkLabel = (type: NotificationType): string => {
  switch (type) {
    case NotificationType.COMPLAINT_STATUS_UPDATE:
      return "View your complaint";
    case NotificationType.COMPLAINT_ASSIGNED:
      return "View the complaint";
    case NotificationType.DOUBT_ANSWER:
    case NotificationType.DOUBT_ACCEPTED:
      return "Read the answer";
    default:
      return "Open CampusCure";
  }
};

export const renderNotificationEmail = (
  input: NotificationEmailInput,
): RenderedEmail => {
  const link = deepLink(input.type, input.data);
  const label = linkLabel(input.type);
  const unsubscribeUrl = `${API_URL}/api/notifications/unsubscribe/${input.unsubscribeToken}`;
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hi,";

  const text = [
    greeting,
    "",
    input.message,
    "",
    `${label}: ${link}`,
    "",
    "—",
    "You are receiving this because you have an account on CampusCure.",
    `To stop these emails: ${unsubscribeUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">CampusCure</p>
      <h1 style="margin:0 0 12px;font-size:18px;line-height:1.4;">${escapeHtml(input.title)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(input.message)}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#1677ff;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">${escapeHtml(label)}</a>
      </p>
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
      <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
        You are receiving this because you have an account on CampusCure.<br />
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;">Stop receiving these emails</a>
      </p>
    </div>
  </body>
</html>`;

  return { subject: input.title, text, html };
};
