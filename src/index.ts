import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";

const PORT = 5000;

// Server startup
const start = async () => {
  console.log("Starting server...");
  try {
    console.log("Connecting to database...");
    console.log(
      "Database URL:",
      process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"),
    ); // Log without password

    // Test connection with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await prisma.$connect();
        console.log("Database connected successfully");
        break;
      } catch (error) {
        retries--;
        console.log(`Connection attempt failed. Retries left: ${retries}`);
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }

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
