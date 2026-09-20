/**
 * CC-01b: refresh token issue, rotation and revocation.
 *
 * Two things matter most here: the raw token must never reach the database,
 * and reuse of a rotated token must end the whole session. The second is the
 * only reason rotation is worth its complexity.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => ({ REFRESH_TOKEN_TTL_DAYS: 7 }));

import {
  hashRefreshToken,
  issueRefreshToken,
  purgeExpiredRefreshTokens,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../../services/auth/refreshTokens.js";

const USER = "user-1";

const storedToken = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  userId: USER,
  expiresAt: new Date(Date.now() + 86_400_000),
  revokedAt: null,
  user: { isActive: true },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.refreshToken.create.mockResolvedValue({});
  db.prisma.refreshToken.update.mockResolvedValue({});
  db.prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
  db.prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
});

describe("issueRefreshToken", () => {
  it("returns a high-entropy token", async () => {
    const { token } = await issueRefreshToken(USER);
    // 48 random bytes, base64url encoded.
    expect(token.length).toBeGreaterThanOrEqual(60);
  });

  /** A database leak must not hand over working sessions. */
  it("stores only the hash, never the raw token", async () => {
    const { token } = await issueRefreshToken(USER);

    const data = db.prisma.refreshToken.create.mock.calls[0]![0].data;
    expect(data.tokenHash).toBe(hashRefreshToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("issues a different token every time", async () => {
    const a = await issueRefreshToken(USER);
    const b = await issueRefreshToken(USER);
    expect(a.token).not.toBe(b.token);
  });

  it("records the user agent, truncated", async () => {
    await issueRefreshToken(USER, "x".repeat(400));
    const data = db.prisma.refreshToken.create.mock.calls[0]![0].data;
    expect(data.userAgent).toHaveLength(255);
  });

  it("omits the user agent when absent rather than storing empty", async () => {
    await issueRefreshToken(USER);
    const data = db.prisma.refreshToken.create.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("userAgent");
  });
});

describe("rotateRefreshToken", () => {
  it("issues a new token and revokes the presented one", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(storedToken());

    const result = await rotateRefreshToken("presented");

    expect(result.ok).toBe(true);
    expect(db.prisma.refreshToken.create).toHaveBeenCalledOnce();
    expect(db.prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-1" },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it("looks the token up by hash, not by value", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(storedToken());

    await rotateRefreshToken("presented");

    expect(db.prisma.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashRefreshToken("presented") },
      }),
    );
  });

  /**
   * The reason rotation exists. A rotated token reappearing means someone kept
   * a copy, so the whole family goes.
   */
  it("revokes EVERY token for the user when a rotated one is reused", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ revokedAt: new Date() }),
    );

    const result = await rotateRefreshToken("stolen");

    expect(result).toEqual({ ok: false, reason: "reused" });
    expect(db.prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, revokedAt: null },
      }),
    );
    // Critically, no replacement is handed out.
    expect(db.prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(rotateRefreshToken("nope")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects an expired token", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const result = await rotateRefreshToken("old");

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(db.prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  /** A deactivated account must not refresh its way back in. */
  it("rejects a token belonging to a deactivated user", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ user: { isActive: false } }),
    );

    const result = await rotateRefreshToken("valid-but-disabled");

    expect(result).toEqual({ ok: false, reason: "user_inactive" });
    expect(db.prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("checks expiry before issuing anything", async () => {
    db.prisma.refreshToken.findUnique.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );
    await rotateRefreshToken("x");
    expect(db.prisma.refreshToken.update).not.toHaveBeenCalled();
  });
});

describe("revocation", () => {
  it("revokes a single token by hash, and only if not already revoked", async () => {
    await revokeRefreshToken("bye");

    expect(db.prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashRefreshToken("bye"), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("revoking an unknown token is silent", async () => {
    db.prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(revokeRefreshToken("never-existed")).resolves.toBeUndefined();
  });

  it("revokeAllForUser reports how many were revoked", async () => {
    db.prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
    await expect(revokeAllForUser(USER)).resolves.toBe(3);
  });

  it("purge removes only expired rows", async () => {
    db.prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

    await expect(purgeExpiredRefreshTokens()).resolves.toBe(5);
    expect(db.prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
