import "dotenv/config";
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

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
