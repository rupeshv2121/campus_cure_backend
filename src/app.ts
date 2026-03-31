import cors from "cors";
import express from "express";
import routes from "./routes/index.js";
import { prisma } from "./config/database.js";

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
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

app.use(routes);

app.get("/", (_req, res) => {
  res.send("Hello from TypeScript backend 🚀");
});

// Keep DB alive endpoint - hit this URL to ensure DB pool gets activity
app.get("/keep-db-alive", async (_req, res) => {
  try {
    // Query a lightweight table for a single id to warm up connections
    await prisma.user.findFirst({ select: { id: true } });
    res.json({ status: "DB active" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

export default app;
