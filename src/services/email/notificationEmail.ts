/**
 * The email channel over the existing Notification model (CC-40).
 *
 * Attaches to `createNotification`, so no caller learns that email exists and
 * a fifth notification helper gets the channel for free.
 *
 * See docs/specs/CC-40-email-notifications.md.
 */

import { randomBytes } from "node:crypto";
import { MessageChannel, NotificationType } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { NOTIFICATION_EMAILS_ENABLED } from "../../config/env.js";
import { enqueueEmail, triggerEmailDrainInBackground } from "./outbox.js";
import { renderNotificationEmail } from "./templates.js";

/**
 * Which notification types are worth an email.
 *
 * ANSWER_UPVOTED is excluded deliberately: high volume, zero urgency, and
 * mailing it is how a product teaches people to filter its mail. GENERAL is
 * unclassified by definition, so it opts in per call instead.
 *
 * A caller that genuinely knows better can override either way.
 */
export const EMAILS_BY_TYPE: Record<NotificationType, boolean> = {
  [NotificationType.COMPLAINT_STATUS_UPDATE]: true,
  [NotificationType.COMPLAINT_ASSIGNED]: true,
  [NotificationType.DOUBT_ANSWER]: true,
  [NotificationType.DOUBT_ACCEPTED]: true,
  [NotificationType.ANSWER_UPVOTED]: false,
  [NotificationType.GENERAL]: false,
};

export const shouldEmailType = (type: NotificationType): boolean =>
  EMAILS_BY_TYPE[type] ?? false;

/**
 * Get or mint this user's unsubscribe token.
 *
 * Minted lazily so no backfill was needed, and random rather than derived from
 * the user id: this value travels in clear text through mail servers, logs and
 * forwarded messages, so it must not be forgeable from anything else or reveal
 * who it belongs to.
 */
const ensureUnsubscribeToken = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      emailNotifications: true,
      unsubscribeToken: true,
    },
  });

  if (!user || !user.emailNotifications) return null;
  if (user.unsubscribeToken) return user.unsubscribeToken;

  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: { unsubscribeToken: token },
  });

  return token;
};

export interface NotificationEmailRequest {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: unknown;
  /** Explicit override. Beats the type policy in both directions. */
  email?: boolean | undefined;
}

export interface NotificationEmailOutcome {
  sent: boolean;
  reason?: string;
}

/**
 * Queue the email for one notification.
 *
 * NEVER THROWS. Email is strictly additive to an in-app notification, and a
 * mail problem must not roll back a complaint assignment or stop the bell
 * updating. Every failure is logged and swallowed; the caller gets a reason.
 */
export const queueNotificationEmail = async (
  request: NotificationEmailRequest,
): Promise<NotificationEmailOutcome> => {
  try {
    if (!NOTIFICATION_EMAILS_ENABLED) {
      return { sent: false, reason: "notifications-disabled" };
    }

    // Explicit intent beats the table, in both directions.
    const wanted = request.email ?? shouldEmailType(request.type);
    if (!wanted) return { sent: false, reason: "type-suppressed" };

    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        email: true,
        name: true,
        emailNotifications: true,
        telegramChatId: true,
      },
    });

    if (!user) return { sent: false, reason: "no-user" };
    if (!user.emailNotifications) return { sent: false, reason: "opted-out" };
    if (!user.email) return { sent: false, reason: "no-address" };

    const unsubscribeToken = await ensureUnsubscribeToken(request.userId);
    if (!unsubscribeToken) return { sent: false, reason: "opted-out" };

    const rendered = renderNotificationEmail({
      type: request.type,
      title: request.title,
      message: request.message,
      data: request.data,
      unsubscribeToken,
      recipientName: user.name?.split(" ")[0],
    });

    const result = await enqueueEmail({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      // The notification id is unique and stable, so a retried handler cannot
      // produce a second email for the same event.
      dedupeKey: `notification:${request.notificationId}`,
    });

    // CC-42: the same message on every channel the user has linked. Queued
    // separately so one provider being down cannot stop the other, and given
    // a distinct dedupe key so the two do not collide on the unique index.
    if (user.telegramChatId) {
      await enqueueEmail({
        channel: MessageChannel.TELEGRAM,
        to: user.telegramChatId,
        subject: rendered.subject,
        text: rendered.text,
        dedupeKey: `notification:${request.notificationId}:telegram`,
      });
    }

    if (!result.queued) {
      return { sent: false, reason: result.reason ?? "not-queued" };
    }

    // Best effort; the daily cron is the floor. See CC-03.
    triggerEmailDrainInBackground();
    return { sent: true };
  } catch (error) {
    console.error(
      "[CC-40] could not queue notification email:",
      (error as Error).message,
    );
    return { sent: false, reason: "error" };
  }
};

/**
 * Turn a user's notification email off by token.
 *
 * Idempotent, and returns false only when the token matches nobody - so a
 * second click reports success rather than an alarming error.
 */
export const unsubscribeByToken = async (token: string): Promise<boolean> => {
  if (!token) return false;

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });

  if (!user) return false;

  await prisma.user.update({
    where: { id: user.id },
    data: { emailNotifications: false },
  });

  return true;
};

/** Does this token identify anyone? Used by the confirmation page. */
export const unsubscribeTokenExists = async (
  token: string,
): Promise<boolean> => {
  if (!token) return false;

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });

  return Boolean(user);
};
