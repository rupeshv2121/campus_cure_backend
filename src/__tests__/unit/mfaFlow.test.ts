/**
 * CC-62 / CC-63: two-factor login and email sign-in codes, at the route level.
 *
 * The assertions that matter most: a password alone earns no token for a 2FA
 * user; neither does an email code; a code cannot be replayed; and the email
 * endpoint answers identically whether or not the account exists.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.FACE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.EMAIL_REDIRECT_TO;
});

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_email: { to: string; subject: string }) => ({
    providerId: "x",
  })),
}));

vi.mock("../../config/database.js", async () => {
  const { prismaMock } = await import("../helpers/prismaMock.js");
  return { prisma: prismaMock, JWT_SECRET: process.env.JWT_SECRET };
});
vi.mock("../../services/email/resend.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...email,
}));

import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import request from "supertest";
import app from "../../app.js";
import { bearerFor, userForRole } from "../helpers/auth.js";
import {
  prismaMock,
  resetMockState,
  setLoginUser,
  setMockUser,
} from "../helpers/prismaMock.js";
import { encryptSecret, hashRecoveryCode } from "../../services/auth/mfa.js";
import { generateTotpSecret, stepAt, totpAt } from "../../services/auth/totp.js";

const stub = (model: string, method: string): ReturnType<typeof vi.fn> =>
  (prismaMock as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[
    model
  ]![method]!;

const PASSWORD = "correct-horse-battery";

/**
 * A fresh client address per request. The auth limiters are real and keep
 * their counts across tests in this file, so without this the sixth
 * deliberate failure would start answering 429.
 */
let ipCounter = 0;
const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const post = (path: string) => request(app).post(path).set("X-Forwarded-For", freshIp());
const SECRET = generateTotpSecret();
let hashed = "";

/**
 * Every stub these tests queue values on. clearAllMocks does not discard an
 * unconsumed mockResolvedValueOnce, so a test that fails early (wrong nonce,
 * exhausted challenge) would hand its leftovers to the next test. Each stub is
 * reset and given back its default behaviour instead.
 */
const QUEUED: Array<[string, string]> = [
  ["user", "findUnique"],
  ["user", "findFirst"],
  ["user", "update"],
  ["user", "updateMany"],
  ["mfaChallenge", "findUnique"],
  ["mfaChallenge", "create"],
  ["mfaChallenge", "updateMany"],
  ["recoveryCode", "updateMany"],
  ["recoveryCode", "count"],
  ["recoveryCode", "deleteMany"],
  ["emailLoginCode", "findFirst"],
  ["emailLoginCode", "create"],
  ["emailLoginCode", "update"],
  ["emailLoginCode", "updateMany"],
  ["auditLog", "create"],
];
const defaults = new Map(
  QUEUED.map(([model, method]) => [
    `${model}.${method}`,
    stub(model, method).getMockImplementation(),
  ]),
);

beforeEach(async () => {
  resetMockState();
  vi.clearAllMocks();
  for (const [model, method] of QUEUED) {
    const fn = stub(model, method);
    fn.mockReset();
    const impl = defaults.get(`${model}.${method}`);
    if (impl) fn.mockImplementation(impl);
  }
  email.sendEmail.mockResolvedValue({ providerId: "x" });
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
  totpEnabledAt: null,
  erasedAt: null,
  ...over,
});

const liveChallenge = (over: Record<string, unknown> = {}) => ({
  id: "ch-1",
  userId: "user-1",
  nonceHash: createHash("sha256").update("good").digest("hex"),
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  attempts: 0,
  ...over,
});

/** Arrange the lookups /2fa/verify makes, in order. */
const arrangeVerify = (over: { lastStep?: number | null } = {}) => {
  stub("mfaChallenge", "findUnique").mockResolvedValueOnce(liveChallenge());
  stub("user", "findUnique")
    // checkActiveCode
    .mockResolvedValueOnce({
      totpSecretEnc: encryptSecret(SECRET),
      totpLastStep: over.lastStep ?? null,
    })
    // the session lookup
    .mockResolvedValueOnce(account({ totpEnabledAt: new Date() }));
  stub("user", "updateMany").mockResolvedValue({ count: 1 });
  stub("mfaChallenge", "updateMany").mockResolvedValue({ count: 1 });
};

const verify = (body: Record<string, unknown>) =>
  post("/api/auth/2fa/verify")
    .send({ challengeId: "ch-1", nonce: "good", ...body });

describe("password step", () => {
  it("issues NO token when 2FA is on, only a challenge", async () => {
    setLoginUser(account({ totpEnabledAt: new Date() }) as never);
    stub("mfaChallenge", "create").mockResolvedValueOnce({ id: "ch-new" });

    const res = await post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.requiresTotp).toBe(true);
    expect(res.body.challengeId).toBeTruthy();
    expect(res.body.nonce).toBeTruthy();
    expect(res.body.token).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("prefers TOTP over face when both are enrolled", async () => {
    setLoginUser(
      account({ totpEnabledAt: new Date(), faceDescriptorEnc: "x:y:z" }) as never,
    );

    const res = await post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: PASSWORD });

    expect(res.body.requiresTotp).toBe(true);
    expect(res.body.requiresFace).toBeUndefined();
  });

  it("still issues tokens directly when nothing is enrolled", async () => {
    setLoginUser(account() as never);

    const res = await post("/api/auth/login")
      .send({ email: "ravi@example.edu", password: PASSWORD });

    expect(res.body.token).toBeTruthy();
    expect(res.body.requiresTotp).toBeUndefined();
  });
});

describe("POST /api/auth/2fa/verify", () => {
  it("issues a session for a current code", async () => {
    arrangeVerify();
    const res = await verify({ code: totpAt(SECRET, Date.now()) });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("refuses a wrong code", async () => {
    arrangeVerify();
    const res = await verify({ code: "000000" === totpAt(SECRET, Date.now()) ? "111111" : "000000" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("refuses a replayed code", async () => {
    arrangeVerify({ lastStep: stepAt(Date.now()) + 1 });
    const res = await verify({ code: totpAt(SECRET, Date.now()) });
    expect(res.status).toBe(401);
  });

  it("refuses when the replay guard loses a race", async () => {
    arrangeVerify();
    stub("user", "updateMany").mockResolvedValue({ count: 0 });
    const res = await verify({ code: totpAt(SECRET, Date.now()) });
    expect(res.status).toBe(401);
  });

  it("refuses a wrong nonce without checking the code", async () => {
    arrangeVerify();
    const res = await verify({ nonce: "bad", code: totpAt(SECRET, Date.now()) });
    expect(res.status).toBe(401);
  });

  it("refuses an exhausted challenge", async () => {
    stub("mfaChallenge", "findUnique").mockResolvedValueOnce(
      liveChallenge({ attempts: 5 }),
    );
    const res = await verify({ code: "123456" });
    expect(res.status).toBe(401);
  });

  it("accepts a recovery code, says how many remain, and audits it", async () => {
    stub("mfaChallenge", "findUnique").mockResolvedValueOnce(liveChallenge());
    stub("user", "findUnique")
      .mockResolvedValueOnce({ totpSecretEnc: encryptSecret(SECRET), totpLastStep: null })
      .mockResolvedValueOnce(account({ totpEnabledAt: new Date() }));
    stub("mfaChallenge", "updateMany").mockResolvedValue({ count: 1 });
    stub("recoveryCode", "updateMany").mockResolvedValue({ count: 1 });
    stub("recoveryCode", "count").mockResolvedValue(9);

    const res = await verify({ recoveryCode: "abcde-fghjk" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.recoveryCodesRemaining).toBe(9);
    // Matched on the normalised hash, so case and the dash are forgiven.
    const where = stub("recoveryCode", "updateMany").mock.calls[0]![0].where;
    expect(where.codeHash).toBe(hashRecoveryCode("ABCDEFGHJK"));
    expect(where.usedAt).toBeNull();
    expect(stub("auditLog", "create")).toHaveBeenCalled();
  });
});

describe("enrolment", () => {
  const student = userForRole("STUDENT");
  const auth = () => bearerFor(student);

  it("returns ten recovery codes when the first code is right", async () => {
    setMockUser(student);
    stub("user", "findUnique")
      .mockResolvedValueOnce(student) // authenticate
      .mockResolvedValueOnce({
        totpPendingSecretEnc: encryptSecret(SECRET),
        totpEnabledAt: null,
      });

    const res = await post("/api/auth/2fa/enable")
      .set(...auth())
      .send({ code: totpAt(SECRET, Date.now()) });

    expect(res.status).toBe(200);
    expect(res.body.recoveryCodes).toHaveLength(10);
    expect(res.body.recoveryCodes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  });

  it("does not enable 2FA on a wrong first code", async () => {
    setMockUser(student);
    stub("user", "findUnique")
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce({
        totpPendingSecretEnc: encryptSecret(SECRET),
        totpEnabledAt: null,
      });

    const res = await post("/api/auth/2fa/enable")
      .set(...auth())
      .send({ code: "12345" });

    expect(res.status).toBe(400);
    expect(stub("user", "update")).not.toHaveBeenCalled();
  });

  /** A stolen session alone must not be able to remove the second factor. */
  it("refuses to disable without the password", async () => {
    setMockUser(student);
    stub("user", "findUnique")
      .mockResolvedValueOnce(student)
      .mockResolvedValueOnce({ password: hashed, totpEnabledAt: new Date() })
      .mockResolvedValueOnce({ totpSecretEnc: encryptSecret(SECRET), totpLastStep: null });
    stub("user", "updateMany").mockResolvedValue({ count: 1 });

    const res = await post("/api/auth/2fa/disable")
      .set(...auth())
      .send({ password: "wrong", code: totpAt(SECRET, Date.now()) });

    expect(res.status).toBe(401);
    expect(stub("recoveryCode", "deleteMany")).not.toHaveBeenCalled();
  });
});

describe("email sign-in codes (CC-63)", () => {
  it("answers identically for unknown and known addresses", async () => {
    stub("user", "findFirst").mockResolvedValueOnce(null);
    const unknown = await post("/api/auth/email-login/request")
      .send({ email: "nobody@example.edu" });

    stub("user", "findFirst").mockResolvedValueOnce(account());
    const known = await post("/api/auth/email-login/request")
      .send({ email: "ravi@example.edu" });

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    // ...but only the real account was sent anything.
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0]![0]).toMatchObject({
      to: "ravi@example.edu",
    });
  });

  it("stores only a keyed hash of the code, never the code", async () => {
    stub("user", "findFirst").mockResolvedValueOnce(account());
    await post("/api/auth/email-login/request")
      .send({ email: "ravi@example.edu" });

    const sent = email.sendEmail.mock.calls[0]![0].subject;
    const code = sent.slice(0, 6);
    const stored = stub("emailLoginCode", "create").mock.calls[0]![0].data.codeHash;

    expect(stored).not.toContain(code);
    expect(stored).not.toBe(createHash("sha256").update(code).digest("hex"));
  });

  it("hides a failed send behind the same answer", async () => {
    stub("user", "findFirst").mockResolvedValueOnce(account());
    email.sendEmail.mockRejectedValueOnce(new Error("resend down"));

    const res = await post("/api/auth/email-login/request")
      .send({ email: "ravi@example.edu" });

    expect(res.status).toBe(200);
  });

  /** The email code replaces the password, never the second factor. */
  it("still demands TOTP after a correct email code", async () => {
    // Issue a code we know, by intercepting the email.
    stub("user", "findFirst").mockResolvedValueOnce(account());
    await post("/api/auth/email-login/request")
      .send({ email: "ravi@example.edu" });
    const code = email.sendEmail.mock.calls[0]![0].subject.slice(0, 6);
    const codeHash = stub("emailLoginCode", "create").mock.calls[0]![0].data.codeHash;

    stub("user", "findFirst").mockResolvedValueOnce(account({ totpEnabledAt: new Date() }));
    stub("emailLoginCode", "findFirst").mockResolvedValueOnce({
      id: "c-1",
      codeHash,
      attempts: 0,
    });
    stub("emailLoginCode", "updateMany").mockResolvedValueOnce({ count: 1 });

    const res = await post("/api/auth/email-login/verify")
      .send({ email: "ravi@example.edu", code });

    expect(res.status).toBe(200);
    expect(res.body.requiresTotp).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it("refuses a wrong code and counts the attempt", async () => {
    stub("user", "findFirst").mockResolvedValueOnce(account());
    stub("emailLoginCode", "findFirst").mockResolvedValueOnce({
      id: "c-1",
      codeHash: "not-it",
      attempts: 0,
    });

    const res = await post("/api/auth/email-login/verify")
      .send({ email: "ravi@example.edu", code: "123456" });

    expect(res.status).toBe(401);
    expect(stub("emailLoginCode", "update")).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
  });
});
