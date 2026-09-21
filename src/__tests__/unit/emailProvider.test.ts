/**
 * CC-03: the Resend boundary, and the outbox with email switched off.
 *
 * The redirect is the part that matters most here. There are 25 real users in
 * this database, and the difference between a verified domain and an
 * unverified one is the difference between test mail going nowhere and test
 * mail going to all of them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  RESEND_API_KEY: "re_test_key" as string | undefined,
  EMAIL_FROM: "CampusCure <onboarding@resend.dev>",
  EMAIL_REDIRECT_TO: undefined as string | undefined,
}));

vi.mock("../../config/env.js", () => env);

import { PermanentEmailError, sendEmail } from "../../services/email/resend.js";

const fetchMock = vi.fn();
const original = globalThis.fetch;

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, body: unknown) =>
  ({ ok: false, status, json: async () => body }) as Response;

beforeEach(() => {
  vi.clearAllMocks();
  env.RESEND_API_KEY = "re_test_key";
  env.EMAIL_REDIRECT_TO = undefined;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = original;
});

const email = {
  to: "student@example.edu",
  subject: "Your doubt was answered",
  text: "Someone answered.",
};

const bodyOf = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe("sendEmail", () => {
  it("posts to Resend and returns the provider id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "resend-123" }));

    await expect(sendEmail(email)).resolves.toEqual({
      providerId: "resend-123",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(bodyOf().to).toEqual(["student@example.edu"]);
  });

  it("sends the API key as a bearer token and nowhere else", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "resend-123" }));

    await sendEmail(email);

    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(init.body).not.toContain("re_test_key");
  });

  it("omits html when there is none, rather than sending null", async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: "x" }));

    await sendEmail(email);

    expect(bodyOf()).not.toHaveProperty("html");
  });

  it("diverts to EMAIL_REDIRECT_TO and keeps the real recipient visible", async () => {
    env.EMAIL_REDIRECT_TO = "owner@example.com";
    fetchMock.mockResolvedValueOnce(ok({ id: "x" }));

    await sendEmail(email);

    const body = bodyOf();
    expect(body.to).toEqual(["owner@example.com"]);
    // Traceable to who should have received it.
    expect(body.subject).toBe(
      "[to: student@example.edu] Your doubt was answered",
    );
  });

  it("treats a 4xx as permanent, so it is not retried", async () => {
    fetchMock.mockResolvedValueOnce(
      fail(422, { message: "The domain is not verified" }),
    );

    await expect(sendEmail(email)).rejects.toBeInstanceOf(PermanentEmailError);
  });

  it("treats 429 as transient, because quota resets", async () => {
    fetchMock.mockResolvedValueOnce(fail(429, { message: "Too many requests" }));

    const error = await sendEmail(email).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PermanentEmailError);
  });

  it("treats a 5xx as transient", async () => {
    fetchMock.mockResolvedValueOnce(fail(503, { message: "upstream" }));

    const error = await sendEmail(email).catch((e) => e);
    expect(error).not.toBeInstanceOf(PermanentEmailError);
  });

  it("fails loudly when accepted without an id", async () => {
    fetchMock.mockResolvedValueOnce(ok({}));

    await expect(sendEmail(email)).rejects.toThrow(/no id/i);
  });

  it("refuses to pretend it sent anything with no key configured", async () => {
    env.RESEND_API_KEY = undefined;

    await expect(sendEmail(email)).rejects.toBeInstanceOf(PermanentEmailError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
