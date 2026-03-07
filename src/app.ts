import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

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

export default app;
