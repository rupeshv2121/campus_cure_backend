import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma, JWT_SECRET } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";
import { Role } from "../generated/prisma/index.js";

// Authentication Middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: Role; username: string };

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Role-based Authorization Middleware
export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    next();
  };
};