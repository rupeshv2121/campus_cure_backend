/**
 * Web push notifications (CC-41).
 *
 * A third channel on the CC-03 outbox, beside email and Telegram. Pushes are
 * queued, never sent inline: on Vercel a lambda can freeze mid-request, and
 * the outbox is what guarantees a retry. Encryption and VAPID signing are the
 * `web-push` package's job - that is the half of this not to hand-roll.
 *
 * See docs/specs/CC-41-web-push.md.
 */

import { MessageChannel, type NotificationType } from "@prisma/client";
import webpush, { WebPushError } from "web-push";
import { prisma } from "../../config/database.js";
import {
  PUSH_ENABLED,
  PUSH_MAX_SUBSCRIPTIONS_PER_USER,
  VAPID_PRIVATE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
} from "../../config/env.js";
import { PermanentEmailError } from "../email/resend.js";

let configured = false;
const configure = () => {
  if (configured || !PUSH_ENABLED) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  configured = true;
};

export class PushError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PushError";
  }
}

/** What the service worker receives and shows. Kept small: push payloads cap at ~4 KB. */
export interface PushPayload {
  title: string;
  body: string;
  /** Collapses repeats of the same event into one notification on the device. */
  tag?: string;
  /** The in-app notification to open on click. */
  notificationId?: string;
  type?: NotificationType;
}

const MAX_BODY = 300;

export interface SubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/**
 * Store a browser's subscription. Upserts on the endpoint: a browser that
 * re-subscribes, or a shared computer where a different user signs in, takes
 * the row over rather than duplicating it.
 */
export const saveSubscription = async (
  userId: string,
  input: SubscriptionInput,
  userAgent?: string,
) => {
  if (!PUSH_ENABLED) throw new PushError("Push notifications are not configured.", 503);

  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";

  // Only https endpoints: anything else would make this server POST to an
  // address a client chose, which is a server-side request forgery primitive.
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new PushError("Invalid subscription.");
  }
  if (url.protocol !== "https:" || !p256dh || !auth || endpoint.length > 1000) {
    throw new PushError("Invalid subscription.");
  }

  const existing = await prisma.pushSubscription.count({ where: { userId } });
  const mine = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { userId: true },
  });
  if (existing >= PUSH_MAX_SUBSCRIPTIONS_PER_USER && mine?.userId !== userId) {
    throw new PushError(
      "Too many devices are registered. Turn notifications off on one you no longer use.",
      409,
    );
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, userAgent: userAgent?.slice(0, 300) ?? null },
    update: { userId, p256dh, auth, userAgent: userAgent?.slice(0, 300) ?? null },
    select: { id: true },
  });
};

/** Remove one browser's subscription. Scoped to the caller: nobody else's. */
export const removeSubscription = async (userId: string, endpoint: unknown) => {
  if (typeof endpoint !== "string") return 0;
  const { count } = await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return count;
};

/**
 * Queue one push per device for a notification. NEVER THROWS, for the same
 * reason queueNotificationEmail does not: a push is additive to the in-app
 * notification and must not roll back whatever caused it.
 *
 * Independent of the email opt-out on purpose. Someone who turned off email
 * may well want the browser alert, and they turned this on separately.
 */
export const queueNotificationPush = async (input: {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}): Promise<number> => {
  if (!PUSH_ENABLED) return 0;

  try {
    const devices = await prisma.pushSubscription.findMany({
      where: { userId: input.userId },
      select: { id: true },
    });
    if (devices.length === 0) return 0;

    const payload: PushPayload = {
      title: input.title.slice(0, 120),
      body:
        input.message.length > MAX_BODY
          ? `${input.message.slice(0, MAX_BODY - 1)}…`
          : input.message,
      tag: `notification:${input.notificationId}`,
      notificationId: input.notificationId,
      type: input.type,
    };

    // Imported lazily: the outbox imports this module for sendPush, and a
    // static import back would be a cycle.
    const { enqueueEmail } = await import("../email/outbox.js");
    for (const device of devices) {
      await enqueueEmail({
        channel: MessageChannel.PUSH,
        to: device.id,
        subject: payload.title,
        text: JSON.stringify(payload),
        dedupeKey: `notification:${input.notificationId}:push:${device.id}`,
      });
    }
    return devices.length;
  } catch (error) {
    console.error("[CC-41] could not queue push:", (error as Error).message);
    return 0;
  }
};

/** True when the push service says this subscription is gone for good. */
export const isGoneSubscription = (error: unknown): boolean =>
  error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410);

/**
 * Deliver one queued push. Same error contract as the email and Telegram
 * senders: a permanent failure is thrown as PermanentEmailError so the drain
 * parks it instead of retrying, and a vanished subscription is deleted.
 */
export const sendPush = async (
  subscriptionId: string,
  body: string,
): Promise<{ providerId: string }> => {
  if (!PUSH_ENABLED) {
    throw new PermanentEmailError("Push is not configured. Set the VAPID keys.");
  }
  configure();

  const device = await prisma.pushSubscription.findUnique({
    where: { id: subscriptionId },
  });
  // Unsubscribed after the push was queued: nothing to deliver to, ever.
  if (!device) throw new PermanentEmailError("Subscription no longer exists.");

  try {
    const result = await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      body,
      // A day: a notification older than that is history, not news.
      { TTL: 24 * 60 * 60, urgency: "normal" },
    );

    await prisma.pushSubscription.update({
      where: { id: device.id },
      data: { lastSuccessAt: new Date() },
    });

    return { providerId: result.headers?.location ?? `push:${result.statusCode}` };
  } catch (error) {
    if (isGoneSubscription(error)) {
      // The user revoked permission or the browser dropped the subscription.
      await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
      throw new PermanentEmailError("Subscription expired; removed.");
    }

    const status = error instanceof WebPushError ? error.statusCode : 0;
    if (status >= 400 && status < 500 && status !== 429) {
      throw new PermanentEmailError(`Push rejected: HTTP ${status}`);
    }
    throw error;
  }
};
