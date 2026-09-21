/**
 * CC-60: the two-step login, end to end at the route level.
 *
 * The single most important assertion here is that a password alone does not
 * produce a token for an enrolled user, and that the old 1:N endpoint is gone
 * rather than merely unreachable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.FACE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});

import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../app.js";
import {
  prismaMock,
  resetMockState,
  setLoginUser,
} from "../helpers/prismaMock.js";
import { hashNonce } from "../../services/auth/faceChallenge.js";
import { encryptDescriptor } from "../../services/auth/faceCrypto.js";

const stub = (model: string, method: string): ReturnType<typeof vi.fn> =>
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[
    model
  ]![method]!;

const PASSWORD = "correct-horse-battery";

const descriptor = (seed = 0, delta = 0): number[] =>
  Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) * 0.1 + delta);

let hashed = "";

beforeEach(async () => {
  resetMockState();
  vi.clearAllMocks();
  if (!hashed) hashed = await bcrypt.hash(PASSWORD, 10);
});

const account = (over: Record<string, unknown> = {}) => ({
  id: "user-1",
  name: "Ravi",
  email: "ravi@example.edu",
  password: hashed,
  userID: "S001",
  university: "Test",
  role: "STUDENT",
  approvalStatus: "APPROVED",
  isActive: true,
  faceDescriptorEnc: null,
  ...over,
});

/** A live challenge whose nonce is "good". */
const liveChallenge = () => ({
  id: "ch-1",
  userId: "user-1",
  nonceHash: hashNonce("good"),
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  attempts: 0,
});

/** Wire up a verify attempt against an enrolled template. */
const arrangeVerify = () => {
  stub("faceChallenge", "findUnique").mockResolvedValueOnce(liveChallenge());
  stub("faceChallenge", "update").mockResolvedValue({});
  stub("user", "findUnique").mockResolvedValueOnce(
    account({ faceDescriptorEnc: encryptDescriptor(descriptor(1)) }),
  );
  stub("user", "update").mockResolvedValue({ id: "user-1" });
  stub("refreshToken", "create").mockResolvedValue({ id: "rt-1" });
};

const verify = (body: Record<string, unknown>) =>
  request(app).post("/api/auth/face/verify").send(body);

/** Matching, but varying frame to frame — what a live face looks like. */
const liveSamples = () => [
  descriptor(1, 0.004),
  descriptor(1, -0.004),
  descriptor(1, 0.008),
];

describe("the removed 1:N endpoint", () => {
  it("POST /api/auth/face-login no longer exists", async () => {
    const res = await request(app)
      .post("/api/auth/face-login")
      .send({ descriptor: descriptor(1) });

    // Deleted, not flagged off: an unauthenticated 1:N endpoint that issues a
    // session is the same vulnerability however it is gated.
    expect(res.status).toBe(404);
  });
});

describe("password step", () => {
  it("issues tokens directly when no face is enrolled", async () => {
    setLoginUser(account() as never);
    stub("user", "update").mockResolvedValue({ id: "user-1" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.requiresFace).toBeUndefined();
  });

  it("issues NO token when a face is enrolled", async () => {
    setLoginUser(
      account({ faceDescriptorEnc: encryptDescriptor(descriptor(1)) }) as never,
    );
    stub("faceChallenge", "deleteMany").mockResolvedValue({ count: 0 });
    stub("faceChallenge", "create").mockResolvedValue({ id: "ch-1" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.requiresFace).toBe(true);
    expect(res.body.challengeId).toBe("ch-1");
    expect(res.body.nonce).toBeTruthy();
    // The whole point of the demotion.
    expect(res.body.token).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("creates no challenge for a wrong password", async () => {
    setLoginUser(
      account({ faceDescriptorEnc: encryptDescriptor(descriptor(1)) }) as never,
    );

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: "wrong" });

    expect(res.status).toBe(401);
    expect(stub("faceChallenge", "create")).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/face/verify", () => {
  it("rejects fewer samples than required, before touching the challenge", async () => {
    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: [descriptor(1)],
    });

    expect(res.status).toBe(400);
    expect(stub("faceChallenge", "findUnique")).not.toHaveBeenCalled();
  });

  it("rejects malformed descriptors", async () => {
    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
      ],
    });

    expect(res.status).toBe(400);
  });

  it("rejects a request with no challenge", async () => {
    expect((await verify({ descriptors: liveSamples() })).status).toBe(400);
  });

  it("rejects an unknown challenge with a generic message", async () => {
    stub("faceChallenge", "findUnique").mockResolvedValueOnce(null);

    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: liveSamples(),
    });

    expect(res.status).toBe(401);
    // Nothing that says which half of the guess was wrong.
    expect(res.body.error).toBe("Face verification failed.");
  });

  it("rejects a wrong nonce", async () => {
    stub("faceChallenge", "findUnique").mockResolvedValueOnce(liveChallenge());
    stub("faceChallenge", "update").mockResolvedValue({});

    const res = await verify({
      challengeId: "ch-1",
      nonce: "guessed",
      descriptors: liveSamples(),
    });

    expect(res.status).toBe(401);
  });

  it("rejects samples from a different face", async () => {
    arrangeVerify();

    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: [
        descriptor(60),
        descriptor(60, 0.01),
        descriptor(60, -0.01),
      ],
    });

    expect(res.status).toBe(401);
  });

  it("rejects three identical samples as a static image", async () => {
    arrangeVerify();

    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: [descriptor(1), descriptor(1), descriptor(1)],
    });

    expect(res.status).toBe(401);
  });

  it("issues tokens for matching, varying samples", async () => {
    arrangeVerify();

    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: liveSamples(),
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("burns the challenge on success", async () => {
    arrangeVerify();

    await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: liveSamples(),
    });

    const consumed = stub("faceChallenge", "update").mock.calls.some(
      (call) => (call[0] as { data?: { consumedAt?: unknown } }).data?.consumedAt,
    );
    expect(consumed).toBe(true);
  });

  it("never returns a descriptor, encrypted or otherwise", async () => {
    arrangeVerify();

    const res = await verify({
      challengeId: "ch-1",
      nonce: "good",
      descriptors: liveSamples(),
    });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("faceDescriptor");
    expect(body).not.toContain("Enc");
  });
});
