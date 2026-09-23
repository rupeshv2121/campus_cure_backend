import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { logger } from "./services/observability/logger.js";
import {
  captureException,
  isSentryEnabled,
} from "./services/observability/sentry.js";

const PORT = 5000;

// Server startup
const start = async () => {
  logger.info("starting server", { sentry: isSentryEnabled() });
  try {
    // Host only. The previous version logged the whole URL with the password
    // masked, which still printed the database host, user and project ref on
    // every boot - and one regex change away from printing the password too.
    logger.info("connecting to database", {
      host: (() => {
        try {
          return new URL(process.env.DATABASE_URL ?? "").host;
        } catch {
          return "unparseable";
        }
      })(),
    });

    // Test connection with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await prisma.$connect();
        logger.info("database connected");
        break;
      } catch (error) {
        retries--;
        logger.warn("database connection attempt failed", { retriesLeft: retries });
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }

    app.listen(PORT, () => {
      logger.info("server listening", { port: PORT });
    });
  } catch (error) {
    logger.error("failed to start server", { error });
    process.exitCode = 1;
  }
};

const shutdown = async (signal: string) => {
  logger.info("shutting down", { signal });
  await prisma.$disconnect();
  process.exit(0);
};

/**
 * CC-05: process-level safety net.
 *
 * The Express error handler catches anything thrown inside a request. These
 * two catch what happens outside one - a rejected promise in a background
 * drain, a throw in a timer - which would otherwise terminate the process in
 * Node 15+ with nothing recorded but a stack on stderr.
 *
 * Both report and then let the default behaviour stand. Swallowing an
 * uncaught exception leaves the process in an unknown state, which is a worse
 * failure than restarting.
 */
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled promise rejection", { error: reason });
  void captureException(reason, { tags: { kind: "unhandledRejection" } });
});

process.on("uncaughtException", (error) => {
  logger.error("uncaught exception", { error });
  // Awaited before exiting: the report is the only record of why the process
  // died, so losing it to a race defeats the purpose.
  void captureException(error, { tags: { kind: "uncaughtException" } }).finally(
    () => process.exit(1),
  );
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
