import type { Request } from "express";
import { Role } from "../generated/prisma/index.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
    username: string;
  };
}