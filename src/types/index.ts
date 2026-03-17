import { Role } from "@prisma/client";
import type { Request } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    username: string;
  };
}
