/**
 * The email outbox (CC-03).
 *
 * Enqueue writes a row; a separate drain sends it. No request handler ever
 * waits on a mail provider, and a provider outage degrades to "still queued"
 * rather than to a failed complaint submission.
 *
 * The durability is not optional on Vercel: the lambda freezes once the
 * response is sent, so an un-awaited send after `res.json()` is not guaranteed
 * to run at all.
 *
 * See docs/specs/CC-03-email-infra.md.
 */

import { EmailStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  EMAIL_DRAIN_BATCH_SIZE,
  EMAIL_ENABLED,
  EMAIL_MAX_ATTEMPTS,
} from "../../config/env.js";
import { PermanentEmailError, sendEmail } from "./resend.js";

/** Long enough to diagnose, short enough not to bloat the table. */
const MAX_ERROR_LENGTH = 500;

/**
 * Deliberately loose. This rejects the mistakes that actually occur - an empty
 * string, a name with no address, a stray space - without pretending to
 * implement RFC 5322, which no regex does correctly anyway. The provider is
 * the real authority, and a rejection from it is permanent, not retried.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EnqueueInput {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
  /**
   * Makes the enqueue idempotent. Encode the cause, not the moment -
   * "complaint-assigned:<id>" rather than a timestamp - or a retried handler
   * queues a second copy.
   */
  dedupeKey?: string | undefined;
  /** Hold delivery until this time. Used by backoff, and by callers who want a delay. */
  scheduledAt?: Date | undefined;
  /** Pass the surrounding transaction so the mail commits with its cause. */
  tx?: Prisma.TransactionClient | undefined;
}

export interface EnqueueResult {
  queued: boolean;
  id?: string;
  reason?: string;
}

/**
 * Queue one email.
 *
 * Returns rather than throws on the ordinary "not queued" cases. A
 * notification failing to send must not roll back the complaint that caused
 * it — the caller decides whether it cares, and mostly it should not.
 */
export const enqueueEmail = async (
  input: EnqueueInput,
): Promise<EnqueueResult> => {
  if (!EMAIL_ENABLED) {
    // No table access at all: the migration may not be applied everywhere.
    console.warn(
      `[CC-03] email disabled, not queuing "${input.subject}" for ${input.to}`,
    );
    return { queued: false, reason: "disabled" };
  }

  const to = input.to?.trim().toLowerCase() ?? "";

  // Caught here rather than after five failed attempts.
  if (!LOOKS_LIKE_EMAIL.test(to)) {
    return { queued: false, reason: "invalid-recipient" };
  }

  if (!input.subject?.trim()) {
    return { queued: false, reason: "empty-subject" };
  }

  const db = input.tx ?? prisma;

  const data = {
    to,
    subject: input.subject.trim(),
    bodyText: input.text,
    bodyHtml: input.html ?? null,
    dedupeKey: input.dedupeKey ?? null,
    scheduledAt: input.scheduledAt ?? new Date(),
  };

  // With a dedupe key the unique index does the work; without one every call
  // is a distinct message, which is what a caller who omitted a key asked for.
  if (input.dedupeKey) {
    const row = await db.emailOutbox.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: data,
      // Deliberately empty: an existing row may already be SENT, and
      // rewriting it would either re-send or lose the delivery record.
      update: {},
    });
    return { queued: true, id: row.id };
  }

  const row = await db.emailOutbox.create({ data });
  return { queued: true, id: row.id };
};

export interface DrainResult {
  attempted: number;
  sent: number;
  retrying: number;
  failed: number;
}

/**
 * Backoff between attempts: 1, 2, 4, 8... minutes, capped at an hour.
 *
 * Capped because the daily cron is the floor on retry latency anyway - a
 * backoff longer than the cron interval just means the row waits for cron,
 * which is exactly what should happen.
 */
const backoffFor = (attempts: number): Date => {
  const minutes = Math.min(2 ** Math.max(0, attempts - 1), 60);
  return new Date(Date.now() + minutes * 60 * 1000);
};

/**
 * Send whatever is due.
 *
 * Rows are handled one at a time rather than in parallel: the free tier has a
 * request-rate limit, and a burst of concurrent sends is the fastest way to
 * turn a working queue into a queue of 429s.
 */
export const runEmailDrain = async (): Promise<DrainResult> => {
  const result: DrainResult = { attempted: 0, sent: 0, retrying: 0, failed: 0 };

  if (!EMAIL_ENABLED) return result;

  const due = await prisma.emailOutbox.findMany({
    where: { status: EmailStatus.PENDING, scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: EMAIL_DRAIN_BATCH_SIZE,
  });

  for (const row of due) {
    result.attempted += 1;

    try {
      const { providerId } = await sendEmail({
        to: row.to,
        subject: row.subject,
        text: row.bodyText,
        html: row.bodyHtml ?? undefined,
      });

      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerId,
          attempts: row.attempts + 1,
          lastError: null,
        },
      });

      result.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = (error as Error).message.slice(0, MAX_ERROR_LENGTH);

      // A permanent rejection will not become acceptable on the fifth try, so
      // it is parked immediately rather than burning quota and hiding the
      // cause behind an attempt count.
      const permanent =
        error instanceof PermanentEmailError || attempts >= EMAIL_MAX_ATTEMPTS;

      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          lastError: message,
          ...(permanent
            ? { status: EmailStatus.FAILED }
            : { scheduledAt: backoffFor(attempts) }),
        },
      });

      if (permanent) {
        result.failed += 1;
        console.error(`[CC-03] parked email ${row.id}: ${message}`);
      } else {
        result.retrying += 1;
      }
    }
  }

  return result;
};

/**
 * Drain without making the caller wait.
 *
 * Mirrors CC-10's triggerDrainInBackground. Note this is best-effort by
 * design: on Vercel the lambda can freeze before it finishes, which is exactly
 * why the daily cron re-picks anything still PENDING. Mail is normally sent
 * within a second; the cron is the floor, not the mechanism.
 */
export const triggerEmailDrainInBackground = (): void => {
  if (!EMAIL_ENABLED) return;

  void runEmailDrain().catch((error) => {
    console.error("[CC-03] background drain failed:", (error as Error).message);
  });
};

/** Queue health — what is waiting, what never went out and why. */
export const getEmailStats = async () => {
  if (!EMAIL_ENABLED) {
    return { enabled: false, pending: 0, sent: 0, failed: 0, recentFailures: [] };
  }

  const [pending, sent, failed, recentFailures] = await Promise.all([
    prisma.emailOutbox.count({ where: { status: EmailStatus.PENDING } }),
    prisma.emailOutbox.count({ where: { status: EmailStatus.SENT } }),
    prisma.emailOutbox.count({ where: { status: EmailStatus.FAILED } }),
    prisma.emailOutbox.findMany({
      where: { status: EmailStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, to: true, subject: true, attempts: true, lastError: true },
    }),
  ]);

  return { enabled: true, pending, sent, failed, recentFailures };
};
