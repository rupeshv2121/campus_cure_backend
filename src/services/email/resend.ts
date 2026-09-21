/**
 * The only module that knows Resend exists (CC-03).
 *
 * Everything above it deals in outbox rows. That boundary is what lets the
 * tests mock this wholesale and never touch the network, and what lets CC-42
 * add Telegram as a sibling module rather than as a branch inside the drain.
 *
 * Plain fetch rather than the SDK: the whole integration is one POST, and the
 * SDK would be a dependency and bundle weight for nothing.
 *
 * See docs/specs/CC-03-email-infra.md.
 */

import {
  EMAIL_FROM,
  EMAIL_REDIRECT_TO,
  RESEND_API_KEY,
} from "../../config/env.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
}

export interface SendResult {
  providerId: string;
}

/**
 * Errors the provider will never accept however many times we retry — a
 * malformed address, a rejected sender, an unverified domain. The drain parks
 * these immediately instead of burning five attempts on them.
 */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEmailError";
  }
}

/**
 * Apply the redirect safety catch.
 *
 * The true recipient is carried into the subject rather than dropped, so a
 * diverted message is still traceable to who should have received it.
 */
const resolveRecipient = (
  email: OutgoingEmail,
): { to: string; subject: string } => {
  if (!EMAIL_REDIRECT_TO) {
    return { to: email.to, subject: email.subject };
  }

  return {
    to: EMAIL_REDIRECT_TO,
    subject: `[to: ${email.to}] ${email.subject}`,
  };
};

/**
 * Hand one message to Resend.
 *
 * Throws on failure. The caller decides whether that means retry or park —
 * this module only distinguishes "the provider will never accept this"
 * (PermanentEmailError) from everything else.
 */
export const sendEmail = async (
  email: OutgoingEmail,
): Promise<SendResult> => {
  if (!RESEND_API_KEY) {
    // Callers check EMAIL_ENABLED first. Throwing rather than silently
    // succeeding means a missed check fails loudly in development instead of
    // marking messages SENT that were never sent.
    throw new PermanentEmailError(
      "Email is not configured. Set RESEND_API_KEY.",
    );
  }

  const { to, subject } = resolveRecipient(email);

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok) {
    const detail = payload?.message ?? `HTTP ${response.status}`;

    // 4xx other than 429 is our fault and will not fix itself: a bad address,
    // an unverified sender domain, a revoked key. Retrying wastes quota and
    // hides the real problem behind "attempts: 5".
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw new PermanentEmailError(detail);
    }

    throw new Error(detail);
  }

  if (!payload?.id) {
    throw new Error("Resend accepted the message but returned no id.");
  }

  return { providerId: payload.id };
};
