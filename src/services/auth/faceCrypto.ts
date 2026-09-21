/**
 * Encryption and matching for face templates (CC-60).
 *
 * Biometric template data is regulated under the DPDP Act, and unlike a
 * password it cannot be changed by its subject once leaked. So it does not sit
 * in the database in the clear.
 *
 * See docs/specs/CC-60-face-hardening.md.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  FACE_ENCRYPTION_KEY,
  FACE_LIVENESS_MIN_VARIANCE,
  FACE_MATCH_THRESHOLD,
} from "../../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM's standard nonce length.
const KEY_LENGTH = 32;

export const DESCRIPTOR_LENGTH = 128;

export class FaceCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceCryptoError";
  }
}

const key = (): Buffer => {
  if (!FACE_ENCRYPTION_KEY) {
    throw new FaceCryptoError(
      "FACE_ENCRYPTION_KEY is not set. Face login is disabled.",
    );
  }

  const buffer = Buffer.from(FACE_ENCRYPTION_KEY, "base64");

  if (buffer.length !== KEY_LENGTH) {
    throw new FaceCryptoError(
      `FACE_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${buffer.length}). ` +
        "Generate one: openssl rand -base64 32",
    );
  }

  return buffer;
};

/**
 * Encrypt a descriptor to "iv:tag:ciphertext", all base64.
 *
 * A fresh IV per call, so encrypting the same template twice produces
 * different ciphertext — otherwise the column would leak which users share a
 * template, and whether one changed.
 */
export const encryptDescriptor = (descriptor: number[]): string => {
  if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
    throw new FaceCryptoError(
      `Descriptor must be ${DESCRIPTOR_LENGTH} numbers.`,
    );
  }

  if (!descriptor.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new FaceCryptoError("Descriptor must contain only finite numbers.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const plaintext = Buffer.from(JSON.stringify(descriptor), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
};

/**
 * Decrypt a stored template.
 *
 * Throws on a tampered value rather than returning something plausible — that
 * authentication is the reason for GCM over CBC here.
 */
export const decryptDescriptor = (stored: string): number[] => {
  const parts = stored.split(":");

  if (parts.length !== 3) {
    throw new FaceCryptoError("Stored template is malformed.");
  }

  const [ivB64, tagB64, dataB64] = parts as [string, string, string];

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);

    const descriptor = JSON.parse(plaintext.toString("utf8")) as unknown;

    if (
      !Array.isArray(descriptor) ||
      descriptor.length !== DESCRIPTOR_LENGTH ||
      !descriptor.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      throw new FaceCryptoError("Decrypted template is not a descriptor.");
    }

    return descriptor as number[];
  } catch (error) {
    if (error instanceof FaceCryptoError) throw error;
    // Wrong key, wrong IV, or a modified ciphertext all land here.
    throw new FaceCryptoError("Stored template could not be decrypted.");
  }
};

export const euclideanDistance = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const delta = (a[i] as number) - (b[i] as number);
    sum += delta * delta;
  }

  return Math.sqrt(sum);
};

/** Shape check before anything is compared or decrypted. */
export const isValidDescriptor = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === DESCRIPTOR_LENGTH &&
  value.every((v) => typeof v === "number" && Number.isFinite(v));

export interface MatchOutcome {
  ok: boolean;
  reason?: string;
  bestDistance?: number;
  minVariance?: number;
}

/**
 * Verify submitted samples against one stored template.
 *
 * Two independent checks:
 *
 *  1. EVERY sample must match the template. Requiring all of them, rather than
 *     the best one, stops a caller improving their odds by submitting more.
 *  2. The samples must differ from EACH OTHER. A photograph held to a camera
 *     yields near-identical descriptors frame after frame; a live face does
 *     not sit that still.
 *
 * Check 2 is a speed bump, not liveness detection. The descriptor is computed
 * in the browser, so an attacker who is not using our page can submit three
 * slightly perturbed vectors and pass it trivially. It defeats a held-up
 * photograph in an honest browser, which is what it is for. The password is
 * the control - see the spec.
 */
export const verifySamples = (
  samples: number[][],
  template: number[],
): MatchOutcome => {
  if (samples.length === 0) return { ok: false, reason: "no-samples" };

  let bestDistance = Infinity;

  for (const sample of samples) {
    const distance = euclideanDistance(sample, template);
    bestDistance = Math.min(bestDistance, distance);

    if (distance >= FACE_MATCH_THRESHOLD) {
      return { ok: false, reason: "no-match", bestDistance };
    }
  }

  // Pairwise spread across the submitted frames.
  let minVariance = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      minVariance = Math.min(
        minVariance,
        euclideanDistance(samples[i] as number[], samples[j] as number[]),
      );
    }
  }

  if (samples.length > 1 && minVariance < FACE_LIVENESS_MIN_VARIANCE) {
    return { ok: false, reason: "static-image", bestDistance, minVariance };
  }

  return { ok: true, bestDistance, minVariance };
};

/** Constant-time compare for the challenge nonce hash. */
export const safeEqualHex = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");

  if (left.length !== right.length || left.length === 0) return false;

  return timingSafeEqual(left, right);
};
