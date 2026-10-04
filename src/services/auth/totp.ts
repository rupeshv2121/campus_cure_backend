/**
 * TOTP (RFC 6238) for two-factor authentication (CC-62).
 *
 * Written against node:crypto rather than pulled from a package: the algorithm
 * is forty lines, the test vectors are in the RFC, and this is the one place
 * in the codebase where a dependency's bug is an authentication bypass.
 *
 * Parameters are the ones every authenticator app assumes and many ignore if
 * told otherwise: SHA-1, six digits, thirty-second steps.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOTP_DIGITS = 6;
export const TOTP_STEP_SECONDS = 30;

/**
 * Steps either side of now that still verify. One step covers a phone clock
 * thirty seconds out and a code typed as it rolled over, without widening the
 * guessable window much: three valid codes out of a million.
 */
export const TOTP_WINDOW = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const base32Encode = (buffer: Buffer): string => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];

  return output;
};

export const base32Decode = (input: string): Buffer => {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

/** A new secret: 160 bits, the RFC 4226 recommendation, as base32. */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

/** The step a moment falls in. */
export const stepAt = (timeMs: number): number =>
  Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);

/** HOTP for one counter value (RFC 4226 section 5.3). */
export const hotp = (secret: Buffer, counter: number): string => {
  const message = Buffer.alloc(8);
  // Counters fit in 53 bits for the next few million years.
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
};

export const totpAt = (secretBase32: string, timeMs: number): string =>
  hotp(base32Decode(secretBase32), stepAt(timeMs));

const sameCode = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Check a code. Returns the step it matched, or null.
 *
 * `lastStep` is the step of the previous accepted code. Anything at or before
 * it is refused: a code seen over a shoulder, or replayed from a captured
 * request, must not open a second session in the same thirty seconds.
 */
export const verifyTotp = (
  secretBase32: string,
  code: string,
  options: { now?: number; lastStep?: number | null } = {},
): number | null => {
  const normalised = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalised)) return null;

  const secret = base32Decode(secretBase32);
  const current = stepAt(options.now ?? Date.now());

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = current + offset;
    if (options.lastStep != null && step <= options.lastStep) continue;
    if (sameCode(hotp(secret, step), normalised)) return step;
  }

  return null;
};

/** The URI an authenticator app reads from the QR code. */
export const otpauthUri = (
  secretBase32: string,
  account: string,
  issuer: string,
): string => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
};
