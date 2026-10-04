/**
 * Helpers shared by the faculty controllers.
 *
 * Split out of facultyController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  Prisma
} from "@prisma/client";

export const isTenDigitPhoneNumber = (value: unknown): boolean =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

export const isDoubtUpvoteSchemaMissingError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
};
