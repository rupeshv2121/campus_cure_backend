import cors from "cors";
import express from "express";
import helmet from "helmet";
import routes from "./routes/index.js";
import { FRONTEND_URL } from "./config/env.js";
import { prisma } from "./config/database.js";
import { globalLimiter } from "./middleware/rateLimit.js";

const app = express();

// Vercel terminates TLS and forwards the client address in X-Forwarded-For.
// Without this, express-rate-limit sees the proxy address on every request and
// one abusive client would rate-limit the entire campus.
app.set("trust proxy", 1);

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
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

export default app;
