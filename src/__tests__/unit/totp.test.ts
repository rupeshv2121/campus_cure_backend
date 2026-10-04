/**
 * CC-62: the TOTP implementation, against RFC 6238's own test vectors.
 *
 * This is hand-written crypto on an authentication path, so the RFC vectors
 * are not optional: they are the proof the algorithm is the standard one and
 * that every authenticator app will agree with it.
 */
import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  stepAt,
  totpAt,
  verifyTotp,
} from "../../services/auth/totp.js";

/** RFC 6238 appendix B uses the ASCII string "12345678901234567890" for SHA-1. */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("RFC 6238 test vectors (SHA-1, last six of the eight digits)", () => {
  const vectors: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];

  for (const [seconds, expected] of vectors) {
    it(`T=${seconds} -> ${expected}`, () => {
      expect(totpAt(RFC_SECRET, seconds * 1000)).toBe(expected);
    });
  }
});

describe("RFC 4226 HOTP vectors", () => {
  // Appendix D, six digits.
  const expected = ["755224", "287082", "359152", "969429", "338314"];
  it("matches counters 0-4", () => {
    const secret = Buffer.from("12345678901234567890", "ascii");
    expect(expected.map((_, i) => hotp(secret, i))).toEqual(expected);
  });
});

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 17]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it("forgives spaces, padding and lower case, as people type them", () => {
    expect(base32Decode("mzxw 6ytb oi==")).toEqual(Buffer.from("foobar"));
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base32Decode("ABC1")).toThrow();
  });

  it("generates 160-bit secrets", () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const secret = generateTotpSecret();

  it("accepts the current code and returns its step", () => {
    expect(verifyTotp(secret, totpAt(secret, now), { now })).toBe(stepAt(now));
  });

  it("accepts one step either side, for clock drift", () => {
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), { now })).not.toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now + 30_000), { now })).not.toBeNull();
  });

  it("refuses two steps away", () => {
    expect(verifyTotp(secret, totpAt(secret, now - 60_000), { now })).toBeNull();
  });

  /** A code seen over a shoulder must not open a second session. */
  it("refuses a code at or before the last accepted step", () => {
    const code = totpAt(secret, now);
    expect(verifyTotp(secret, code, { now, lastStep: stepAt(now) })).toBeNull();
  });

  it("refuses anything that is not six digits", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5a"]) {
      expect(verifyTotp(secret, bad, { now })).toBeNull();
    }
  });

  it("tolerates spaces inside a pasted code", () => {
    const code = totpAt(secret, now);
    expect(
      verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { now }),
    ).not.toBeNull();
  });
});

describe("otpauthUri", () => {
  it("builds the URI authenticator apps read from a QR code", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "ravi@example.edu", "CampusCure");
    expect(uri.startsWith("otpauth://totp/CampusCure%3Aravi%40example.edu?")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=CampusCure");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
