import type { Request } from "express";
import { Role } from "@prisma/client";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    username: string;
  };
}