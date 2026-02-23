import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://campuscure-frontend.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.use(routes);

app.get("/", (_req, res) => {
  res.send("Hello from TypeScript backend 🚀");
});

export default app;
