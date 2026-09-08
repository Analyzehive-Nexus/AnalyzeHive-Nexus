import cors from "cors";
import express from "express";
import { adminRouter } from "./routes/admin.js";
import { alertsRouter } from "./routes/alerts.js";
import { authRouter } from "./routes/auth.js";
import { coldChainRouter } from "./routes/coldChain.js";
import { commandCenterRouter } from "./routes/commandCenter.js";
import { commercialTruthRouter } from "./routes/commercialTruth.js";
import { currencyRouter } from "./routes/currency.js";
import { discoveryRouter } from "./routes/discovery.js";
import { governanceRouter } from "./routes/governance.js";
import { healthRouter } from "./routes/health.js";
import { requireAuth } from "./middleware/auth.js";
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

// Public: uptime probes need /api/health without a credential, and /api/auth
// is where a credential is obtained in the first place.
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// Everything below serves account data and requires a bearer token.
app.use("/api/admin", requireAuth, adminRouter);
app.use("/api/infer", requireAuth, inferRouter);
app.use("/api/alerts", requireAuth, alertsRouter);
app.use("/api/notifications", requireAuth, notificationsRouter);
app.use("/api/market-radar", requireAuth, marketRadarRouter);
app.use("/api/commercial-truth", requireAuth, commercialTruthRouter);
app.use("/api/profile", requireAuth, profileRouter);
app.use("/api/system-status", requireAuth, systemStatusRouter);
app.use("/api/supply-chain", requireAuth, supplyChainRouter);
app.use("/api/ingestion", requireAuth, ingestionRouter);
app.use("/api/currency", requireAuth, currencyRouter);
app.use("/api/governance", requireAuth, governanceRouter);
app.use("/api/command-center", requireAuth, commandCenterRouter);
app.use("/api/cold-chain", requireAuth, coldChainRouter);
app.use("/api/discovery", requireAuth, discoveryRouter);

app.use((_req, res) => {
  res.status(404).json({ detail: "Not found" });
});

export default app;
