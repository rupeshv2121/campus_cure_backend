/**
 * Token helpers for the authorization matrix.
 *
 * Tokens are signed with the same secret `setup.ts` puts in the environment,
 * so the app under test verifies them exactly as it would a real one.
 */
import jwt from "jsonwebtoken";
import type { MockUser } from "./prismaMock.js";

export const ROLES = [
  "STUDENT",
  "FACULTY",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type TestRole = (typeof ROLES)[number];

/** A deterministic, active account for the given role. */
export const userForRole = (role: TestRole): MockUser => ({
  id: `00000000-0000-4000-8000-${role.toLowerCase().padEnd(12, "0").slice(0, 12)}`,
  role,
  userID: `${role}_TEST`,
  university: "TEST_UNIVERSITY",
  isActive: true,
  approvalStatus: "APPROVED",
  email: `${role.toLowerCase()}@test.local`,
});

export const signTokenFor = (user: MockUser): string =>
  jwt.sign(
    {
      id: user.id,
      role: user.role,
      userID: user.userID,
      university: user.university,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "5m" },
  );

/** Authorization header for a role, for use with supertest `.set(...)`. */
export const bearerFor = (user: MockUser): [string, string] => [
  "Authorization",
  `Bearer ${signTokenFor(user)}`,
];
