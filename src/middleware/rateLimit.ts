import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

/**
 * Rate limiting — see docs/specs/CC-01-security-baseline.md.
 *
 * NOTE ON SERVERLESS: the default store is in-memory, and on Vercel each lambda
 * instance keeps its own counters. The effective limit is therefore per-instance
 * rather than global — weaker than the numbers below suggest, but a large
 * improvement over no limit at all. If abuse is observed, move to a shared
 * store (Postgres or Redis) without changing these definitions.
 *
 * `app.set("trust proxy", 1)` must be set, or every request appears to come
 * from Vercel's proxy and one attacker blocks the whole campus.
 */

/** Per-IP key, IPv6-safe. `req.ip` can be undefined behind odd proxy setups. */
const ipKey = (req: Request): string => ipKeyGenerator(req.ip ?? "unknown");

/**
 * Login/face-login/register. Keyed by IP *and* the submitted email, so that
 * distributed attempts against a single account are still caught, and a shared
 * campus NAT address does not lock out everyone behind it on one bad actor.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  keyGenerator: (req: Request) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    return `${ipKey(req)}:${email}`;
  },
  message: {
    error: "Too many attempts. Please try again in 15 minutes.",
  },
});

/**
 * Face login. Keyed by IP alone — the request carries a biometric descriptor
 * rather than a claimed identity, so there is no account to key on. Tighter
 * than `authLimiter` because the endpoint searches every enrolled user and is
 * unauthenticated. Full hardening is CC-60.
 */
export const faceLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: {
    error: "Too many face login attempts. Please try again in 15 minutes.",
  },
});

/**
 * Resolve the caller's user id from the bearer token.
 *
 * This limiter is mounted before the routes, so `authenticate` has not run yet
 * and `req.user` is not populated. Verifying the token here (HMAC only, no
 * database round trip) is what makes per-user metering actually work — without
 * it every authenticated request would silently fall back to an IP key, and a
 * whole campus behind one NAT address would share a single 100/min budget.
 *
 * An invalid or absent token is not an error here: it just means we meter by IP
 * and let `authenticate` reject the request further down the stack.
 */
const userIdFromToken = (req: Request): string | undefined => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return undefined;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string };
    return decoded.id;
  } catch {
    return undefined;
  }
};

/**
 * AI chat (CC-15). Tighter than the global limit because every message costs a
 * completion, and tool rounds multiply that. On a free tier one user in a loop
 * can exhaust the quota for the whole campus.
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = userIdFromToken(req);
    return userId ? `chat:${userId}` : ipKey(req);
  },
  message: {
    error: "You are sending messages too quickly. Please wait a moment.",
  },
});

/**
 * Upload signing (CC-02).
 *
 * Signing is cheap for us and expensive later: every signed URL is a licence to
 * write an object we then store and pay for. Metered per user rather than per
 * IP because a shared campus address must not let one abuser exhaust everyone's
 * budget — and because an unauthenticated caller cannot reach this route at all.
 *
 * 20/minute comfortably covers attaching the per-entity maximum several times
 * over, while bounding how fast one account can fill the bucket.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = userIdFromToken(req);
    return userId ? `upload:${userId}` : ipKey(req);
  },
  message: {
    error: "Too many uploads. Please wait a moment and try again.",
  },
});

/**
 * Blanket limit for the whole API. Keyed by user id where possible so that many
 * students behind one campus NAT address are metered individually.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = userIdFromToken(req);
    return userId ? `user:${userId}` : ipKey(req);
  },
  message: {
    error: "Too many requests. Please slow down.",
  },
});
