import { Role } from "@prisma/client";
import type { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    username: string;
  };
}

export interface RejectionHistoryEntry {
  timestamp: string;
  reason: string;
  studentName: string;
}
