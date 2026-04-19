import { Role } from "@prisma/client";
import type { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    userID: string;
    university: string;
  };
}

export interface RejectionHistoryEntry {
  timestamp: string;
  reason: string;
  studentName: string;
}

export interface ComplaintAssignmentHistoryEntry {
  timestamp: string;
  fromAssigneeId: string | null;
  fromAssigneeName: string | null;
  toAssigneeId: string;
  toAssigneeName: string;
  performedById: string | null;
  performedByRole: string;
  mode: "AUTO" | "ADMIN" | "SUPER_ADMIN";
  note?: string | null;
}
