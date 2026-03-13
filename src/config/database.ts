import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@prisma/client";

// Configure connection pool with optimized settings for Supabase
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced for better connection management
  min: 1, // Keep at least one connection alive
  idleTimeoutMillis: 60000, // Keep connections alive longer
  connectionTimeoutMillis: 10000, // Timeout for new connections
  // Enable keep-alive to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"], // Enable logging for debugging
});

// Test connection on startup
pool
  .query("SELECT 1")
  .then(() => console.log("✓ Database pool initialized"))
  .catch((err) => console.error("✗ Database pool initialization failed:", err));

// Handle connection errors
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
  // Don't exit, let the pool recover
});

// Graceful shutdown
const cleanup = async () => {
  try {
    await prisma.$disconnect();
    await pool.end();
    console.log("Database connections closed");
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
};

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

// JWT Secret
export const JWT_SECRET =
  process.env.JWT_SECRET ?? "your-secret-key-change-in-production";
