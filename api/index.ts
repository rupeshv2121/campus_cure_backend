import "dotenv/config";
import app from "../src/app.js";
import { prisma } from "../src/config/database.js";

const CORS_ORIGIN = "https://campus-cure-frontend.vercel.app";

let prismaConnectionPromise: Promise<void> | null = null;

const ensurePrismaConnected = async () => {
  if (!prismaConnectionPromise) {
    prismaConnectionPromise = prisma.$connect();
  }
  await prismaConnectionPromise;
};

export default async function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
) {
  // Always set CORS headers first — before any async work — so that
  // even if the Lambda crashes (e.g. DB timeout) the browser gets a
  // proper error response instead of a header-less crash that looks
  // like a CORS failure.
  const origin = req.headers.origin;
  if (!origin || origin === CORS_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Short-circuit OPTIONS without touching the DB (belt-and-suspenders
  // alongside the vercel.json edge rule).
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    await ensurePrismaConnected();
  } catch (err) {
    console.error("[handler] Database connection failed:", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Service temporarily unavailable. Please try again in a moment.",
      }),
    );
    return;
  }

  return app(req, res);
}
