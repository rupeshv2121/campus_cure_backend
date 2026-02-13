import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./config/database.js";
import routes from "./routes/index.js";

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use(routes);

// Root route
app.get("/", (req, res) => {
  res.send("Hello from TypeScript backend 🚀");
});

// Server startup
const start = async () => {
  console.log("Starting server...");
  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Database connected successfully");

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
