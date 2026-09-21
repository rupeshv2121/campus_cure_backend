/**
 * CC-60: the face challenge state machine.
 *
 * This is what stops a captured face request being replayed, and a known
 * account being brute-forced in descriptor space. The attempt counter in
 * particular has to increment before the descriptors are examined, or
 * abandoning each request buys unlimited tries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    faceChallenge: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => ({
  FACE_CHALLENGE_TTL_SECONDS: 120,
  FACE_MAX_ATTEMPTS: 3,
}));

import {
  claimFaceChallenge,
  consumeFaceChallenge,
  hashNonce,
  issueFaceChallenge,
  purgeExpiredFaceChallenges,
} from "../../services/auth/faceChallenge.js";

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 1_000);

const challenge = (over: Record<string, unknown> = {}) => ({
  id: "ch-1",
  userId: "user-1",
  nonceHash: hashNonce("good-nonce"),
  expiresAt: future(),
  consumedAt: null,
  attempts: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.faceChallenge.create.mockResolvedValue({ id: "ch-1" });
  db.prisma.faceChallenge.update.mockResolvedValue({});
  db.prisma.faceChallenge.deleteMany.mockResolvedValue({ count: 0 });
});

describe("issueFaceChallenge", () => {
  it("returns a nonce and stores only its hash", async () => {
    const issued = await issueFaceChallenge("user-1");

    expect(issued.nonce.length).toBeGreaterThan(20);

    const stored = db.prisma.faceChallenge.create.mock.calls[0]![0].data;
    // Possession of the table must not be possession of the credential.
    expect(stored.nonceHash).toBe(hashNonce(issued.nonce));
    expect(stored.nonceHash).not.toBe(issued.nonce);
  });

  it("invalidates any earlier unconsumed challenge for that user", async () => {
    await issueFaceChallenge("user-1");

    expect(db.prisma.faceChallenge.deleteMany.mock.calls[0]![0].where).toEqual({
      userId: "user-1",
      consumedAt: null,
    });
  });

  it("sets an expiry in the future", async () => {
    await issueFaceChallenge("user-1");

    const { expiresAt } = db.prisma.faceChallenge.create.mock.calls[0]![0].data;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("gives a different nonce every time", async () => {
    const a = await issueFaceChallenge("user-1");
    const b = await issueFaceChallenge("user-1");

    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe("claimFaceChallenge", () => {
  it("accepts a valid challenge and returns its user", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(challenge());

    await expect(claimFaceChallenge("ch-1", "good-nonce")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
  });

  it("counts the attempt BEFORE the caller checks descriptors", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(challenge());

    await claimFaceChallenge("ch-1", "good-nonce");

    // Otherwise abandoning each request buys unlimited tries.
    expect(db.prisma.faceChallenge.update.mock.calls[0]![0].data).toEqual({
      attempts: 1,
    });
  });

  it("rejects a wrong nonce, and still counts the attempt", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(challenge());

    const result = await claimFaceChallenge("ch-1", "wrong");

    expect(result).toEqual({ ok: false, reason: "bad-nonce" });
    expect(db.prisma.faceChallenge.update).toHaveBeenCalled();
  });

  it("rejects an expired challenge without counting an attempt", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(
      challenge({ expiresAt: past() }),
    );

    expect(await claimFaceChallenge("ch-1", "good-nonce")).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(db.prisma.faceChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects a consumed challenge", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(
      challenge({ consumedAt: new Date() }),
    );

    expect(await claimFaceChallenge("ch-1", "good-nonce")).toEqual({
      ok: false,
      reason: "consumed",
    });
  });

  it("rejects once the attempt cap is reached", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(
      challenge({ attempts: 3 }),
    );

    expect(await claimFaceChallenge("ch-1", "good-nonce")).toEqual({
      ok: false,
      reason: "too-many-attempts",
    });
  });

  it("rejects an unknown id", async () => {
    db.prisma.faceChallenge.findUnique.mockResolvedValueOnce(null);

    expect(await claimFaceChallenge("nope", "good-nonce")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("rejects a missing id or nonce without querying", async () => {
    expect(await claimFaceChallenge("", "n")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await claimFaceChallenge("ch-1", "")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(db.prisma.faceChallenge.findUnique).not.toHaveBeenCalled();
  });
});

describe("consumeFaceChallenge", () => {
  it("burns the challenge", async () => {
    await consumeFaceChallenge("ch-1");

    const call = db.prisma.faceChallenge.update.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "ch-1" });
    expect(call.data.consumedAt).toBeInstanceOf(Date);
  });
});

describe("purgeExpiredFaceChallenges", () => {
  it("deletes only expired rows", async () => {
    db.prisma.faceChallenge.deleteMany.mockResolvedValueOnce({ count: 4 });

    await expect(purgeExpiredFaceChallenges()).resolves.toBe(4);

    const where = db.prisma.faceChallenge.deleteMany.mock.calls[0]![0].where;
    expect(where.expiresAt.lt).toBeInstanceOf(Date);
  });
});
