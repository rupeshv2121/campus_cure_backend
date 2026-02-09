import "dotenv/config";
import express from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/index.js";

const app = express();
const PORT = 5000;
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

const start = async () => {
  try {
    await prisma.$connect();

    app.get("/", (req, res) => {
      res.send("Hello from TypeScript backend 🚀");
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
};

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
