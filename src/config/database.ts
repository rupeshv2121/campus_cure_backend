import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

export const prisma = new PrismaClient({ adapter });

// JWT Secret
export const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-in-production";