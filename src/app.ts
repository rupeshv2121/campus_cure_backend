import cors from "cors";
import express from "express";
import helmet from "helmet";
import routes from "./routes/index.js";
import { FRONTEND_URL } from "./config/env.js";
import { prisma } from "./config/database.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
} from "./middleware/observability.js";
import { logger } from "./services/observability/logger.js";

const app = express();

// Vercel terminates TLS and forwards the client address in X-Forwarded-For.
// Without this, express-rate-limit sees the proxy address on every request and
// one abusive client would rate-limit the entire campus.
app.set("trust proxy", 1);

// CC-05: first, so every request - including one helmet or CORS rejects -
// gets an id and a log line. Everything after this runs inside its context.
app.use(requestLogger);

// Security headers (HSTS, X-Content-Type-Options, frame options, ...).
// Mounted before anything that can produce a response.
app.use(helmet());

const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "https://campus-cure-frontend.vercel.app",
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());

// Blanket per-user / per-IP limit. Per-endpoint limits are applied in the
// route modules on top of this.
app.use("/api", globalLimiter);

app.use(routes);

app.get("/", (_req, res) => {
  res.send("Hello from TypeScript backend 🚀");
});

// Keep DB alive endpoint - hit this URL to ensure DB pool gets activity.
// Rate limited explicitly: it sits outside /api, is unauthenticated, and runs a
// database query, so it is otherwise a free amplification vector.
app.get("/keep-db-alive", globalLimiter, async (_req, res) => {
  try {
    // Query a lightweight table for a single id to warm up connections
    await prisma.user.findFirst({ select: { id: true } });
    res.json({ status: "DB active" });
  } catch (error) {
    // The previous version returned `err.message` straight to the caller.
    // A Prisma failure message is not a short string - it contains the
    // database HOST, the absolute path of the file that made the call, and an
    // excerpt of the surrounding SOURCE CODE. This route is unauthenticated
    // and outside /api, so that was published to anyone who asked for it.
    //
    // Verified 2026-09-23 against a deliberately bad DATABASE_URL:
    //   Can't reach database server at <host>
    //   Invalid `prisma.user.findFirst()` invocation in
    //   E:\...\campus_cure_backend\src\app.ts:64:21
    //
    // The detail goes to the logs, where it is actually useful, and the
    // caller gets the health verdict it asked for and nothing more.
    logger.error("keep-db-alive failed", { error });
    res.status(503).json({ status: "DB unavailable" });
  }
});

// CC-05: after every route. Order matters and is easy to get wrong - a 404
// handler mounted before the routes would swallow all of them.
app.use(notFoundHandler);

// CC-05: last. Express identifies this as an error handler by its four
// parameters, so it must stay four-argument even though `next` is unused.
app.use(errorHandler);

export default app;
