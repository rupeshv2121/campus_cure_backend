import { Prisma } from "@prisma/client";
import type { ComplaintAssignmentHistoryEntry } from "../types/index.js";

const parseHistoryArray = (
  value: unknown,
): ComplaintAssignmentHistoryEntry[] => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? (parsed as ComplaintAssignmentHistoryEntry[])
        : [];
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value as ComplaintAssignmentHistoryEntry[];
  }

  return [];
};

export const buildComplaintAssignmentHistoryEntry = (input: {
  fromAssigneeId: string | null;
  fromAssigneeName: string | null;
  toAssigneeId: string;
  toAssigneeName: string;
  performedById: string | null;
  performedByRole: string;
  mode: ComplaintAssignmentHistoryEntry["mode"];
  note?: string | null;
}): ComplaintAssignmentHistoryEntry => ({
  timestamp: new Date().toISOString(),
  fromAssigneeId: input.fromAssigneeId,
  fromAssigneeName: input.fromAssigneeName,
  toAssigneeId: input.toAssigneeId,
  toAssigneeName: input.toAssigneeName,
  performedById: input.performedById,
  performedByRole: input.performedByRole,
  mode: input.mode,
  note: input.note ?? null,
});

export const appendComplaintAssignmentHistory = (
  currentHistory: unknown,
  entry: ComplaintAssignmentHistoryEntry,
): Prisma.InputJsonValue => {
  const history = parseHistoryArray(currentHistory);
  return [...history, entry] as unknown as Prisma.InputJsonValue;
};
