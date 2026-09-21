/**
 * CC-60: template encryption and sample matching.
 *
 * The encryption tests are the ones that matter for compliance — a biometric
 * template cannot be changed by its subject once leaked. The matching tests
 * pin down what the sample checks do and, just as importantly, what they do
 * not: the variance check defeats a held-up photograph, not an attacker
 * posting vectors directly.
 */
import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  // 32 bytes, base64 — a test key, never used anywhere real.
  FACE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  FACE_MATCH_THRESHOLD: 0.5,
  FACE_LIVENESS_MIN_VARIANCE: 0.02,
}));

vi.mock("../../config/env.js", () => env);

import {
  DESCRIPTOR_LENGTH,
  FaceCryptoError,
  decryptDescriptor,
  encryptDescriptor,
  euclideanDistance,
  isValidDescriptor,
  safeEqualHex,
  verifySamples,
} from "../../services/auth/faceCrypto.js";

/** A deterministic descriptor, optionally nudged by `delta` on every axis. */
const descriptor = (seed = 0, delta = 0): number[] =>
  Array.from(
    { length: DESCRIPTOR_LENGTH },
    (_, i) => Math.sin(seed + i) * 0.1 + delta,
  );

describe("encryptDescriptor / decryptDescriptor", () => {
  it("round-trips a descriptor exactly", () => {
    const original = descriptor(1);

    expect(decryptDescriptor(encryptDescriptor(original))).toEqual(original);
  });

  it("produces different ciphertext each time", () => {
    const original = descriptor(1);

    // A fixed IV would leak which users share a template, and when one changed.
    expect(encryptDescriptor(original)).not.toBe(encryptDescriptor(original));
  });

  it("stores nothing recognisable from the plaintext", () => {
    const stored = encryptDescriptor(descriptor(1));

    expect(stored).not.toContain("0.");
    expect(stored.split(":")).toHaveLength(3);
  });

  it("rejects a tampered ciphertext rather than returning wrong data", () => {
    const stored = encryptDescriptor(descriptor(1));
    const [iv, tag, data] = stored.split(":") as [string, string, string];

    const flipped = Buffer.from(data, "base64");
    flipped[0] = (flipped[0] as number) ^ 0xff;

    expect(() =>
      decryptDescriptor(`${iv}:${tag}:${flipped.toString("base64")}`),
    ).toThrow(FaceCryptoError);
  });

  it("rejects a tampered auth tag", () => {
    const stored = encryptDescriptor(descriptor(1));
    const [iv, , data] = stored.split(":") as [string, string, string];
    const wrongTag = Buffer.alloc(16, 1).toString("base64");

    expect(() => decryptDescriptor(`${iv}:${wrongTag}:${data}`)).toThrow(
      FaceCryptoError,
    );
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptDescriptor("nonsense")).toThrow(FaceCryptoError);
    expect(() => decryptDescriptor("a:b")).toThrow(FaceCryptoError);
  });

  it("refuses to encrypt something that is not a descriptor", () => {
    expect(() => encryptDescriptor([1, 2, 3])).toThrow(FaceCryptoError);
    expect(() =>
      encryptDescriptor(Array(DESCRIPTOR_LENGTH).fill(Number.NaN)),
    ).toThrow(FaceCryptoError);
  });

  it("refuses a key of the wrong length", () => {
    const good = env.FACE_ENCRYPTION_KEY;
    env.FACE_ENCRYPTION_KEY = Buffer.alloc(16, 7).toString("base64");

    expect(() => encryptDescriptor(descriptor(1))).toThrow(/32 bytes/);

    env.FACE_ENCRYPTION_KEY = good;
  });
});

describe("isValidDescriptor", () => {
  it("accepts a well-formed descriptor", () => {
    expect(isValidDescriptor(descriptor(1))).toBe(true);
  });

  it("rejects the wrong length, wrong type, and non-finite values", () => {
    expect(isValidDescriptor([1, 2, 3])).toBe(false);
    expect(isValidDescriptor("not an array")).toBe(false);
    expect(isValidDescriptor(Array(DESCRIPTOR_LENGTH).fill("x"))).toBe(false);
    expect(isValidDescriptor(Array(DESCRIPTOR_LENGTH).fill(Infinity))).toBe(
      false,
    );
  });
});

describe("verifySamples", () => {
  const template = descriptor(1);

  /** Samples that match the template but differ from one another. */
  const live = () => [
    descriptor(1, 0.004),
    descriptor(1, -0.004),
    descriptor(1, 0.008),
  ];

  it("accepts live-looking samples that match", () => {
    expect(verifySamples(live(), template).ok).toBe(true);
  });

  it("rejects three identical samples as a static image", () => {
    const frozen = [descriptor(1), descriptor(1), descriptor(1)];

    const outcome = verifySamples(frozen, template);

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe("static-image");
  });

  it("rejects samples from a different face", () => {
    const outcome = verifySamples(
      [descriptor(50), descriptor(50, 0.01), descriptor(50, -0.01)],
      template,
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe("no-match");
  });

  it("requires EVERY sample to match, not just the best one", () => {
    // Otherwise a caller improves their odds by submitting more samples.
    const mixed = [descriptor(1, 0.004), descriptor(1, -0.004), descriptor(90)];

    expect(verifySamples(mixed, template).ok).toBe(false);
  });

  it("rejects an empty submission", () => {
    expect(verifySamples([], template)).toEqual({
      ok: false,
      reason: "no-samples",
    });
  });

  it("does not apply the variance rule to a single sample", () => {
    // One sample cannot be compared with itself; the count is enforced at the
    // route, which is where the requirement belongs.
    expect(verifySamples([descriptor(1)], template).ok).toBe(true);
  });
});

describe("euclideanDistance", () => {
  it("is zero for identical vectors", () => {
    expect(euclideanDistance(descriptor(1), descriptor(1))).toBe(0);
  });

  it("grows with difference", () => {
    const near = euclideanDistance(descriptor(1), descriptor(1, 0.01));
    const far = euclideanDistance(descriptor(1), descriptor(1, 0.5));

    expect(far).toBeGreaterThan(near);
  });

  it("is Infinity for mismatched lengths, never a partial comparison", () => {
    expect(euclideanDistance([1, 2], [1, 2, 3])).toBe(Infinity);
  });
});

describe("safeEqualHex", () => {
  it("matches identical hex and rejects anything else", () => {
    const hex = Buffer.from("abc").toString("hex");

    expect(safeEqualHex(hex, hex)).toBe(true);
    expect(safeEqualHex(hex, Buffer.from("abd").toString("hex"))).toBe(false);
    expect(safeEqualHex(hex, "")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});
