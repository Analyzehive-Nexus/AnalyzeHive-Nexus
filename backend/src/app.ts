import cors from "cors";
import express from "express";
import { alertsRouter } from "./routes/alerts.js";
import { authRouter } from "./routes/auth.js";
import { commercialTruthRouter } from "./routes/commercialTruth.js";
import { healthRouter } from "./routes/health.js";
import { inferRouter } from "./routes/infer.js";
import { ingestionRouter } from "./routes/ingestion.js";
import { marketRadarRouter } from "./routes/marketRadar.js";
import { notificationsRouter } from "./routes/notifications.js";
import { profileRouter } from "./routes/profile.js";
import { supplyChainRouter } from "./routes/supplyChain.js";
import { systemStatusRouter } from "./routes/systemStatus.js";

// CORS_ORIGIN is a comma-separated allowlist of frontend origins. Left unset
// (local dev, or before the frontend domain is known) it falls back to "*",
// which is safe here only because no endpoint relies on cookie credentials.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app = express();

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
  })
);
app.use(express.json({ limit: "5mb" }));

// Root gives a quick "is this thing deployed" answer without needing to know
// the route table.
app.get("/", (_req, res) => {
  res.json({
    service: "analyzehive-backend",
    status: "ok",
    docs: "/api/health",
  });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/infer", inferRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/market-radar", marketRadarRouter);
app.use("/api/commercial-truth", commercialTruthRouter);
app.use("/api/profile", profileRouter);
app.use("/api/system-status", systemStatusRouter);
app.use("/api/supply-chain", supplyChainRouter);
app.use("/api/ingestion", ingestionRouter);

app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

export default app;
