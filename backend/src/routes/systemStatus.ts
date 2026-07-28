import { Router } from "express";

export const systemStatusRouter = Router();

const baseServices = [
  { id: 1, name: "Authentication Service", status: "Operational", uptime: "99.99%", region: "Global", baseLatency: 24 },
  { id: 2, name: "Data Ingestion Pipeline", status: "Operational", uptime: "99.95%", region: "US-East", baseLatency: 145 },
  { id: 3, name: "Notification Engine", status: "Degraded", uptime: "98.50%", region: "EU-West", baseLatency: 410 },
  { id: 4, name: "Payment Gateway", status: "Operational", uptime: "100.00%", region: "Global", baseLatency: 89 },
  { id: 5, name: "AI Inference Cluster", status: "Operational", uptime: "99.90%", region: "APAC", baseLatency: 310 },
  { id: 6, name: "Reporting API", status: "Maintenance", uptime: "N/A", region: "US-West", baseLatency: 0 },
];

const incidents = [
  { id: 1, title: "High Latency in EU-West", time: "12 mins ago", severity: "Medium", status: "Investigating" },
  { id: 2, title: "API Rate Limit Adjusted", time: "2 hours ago", severity: "Low", status: "Resolved" },
  { id: 3, title: "Scheduled Maintenance: Reports", time: "1 day ago", severity: "Info", status: "Completed" },
];

// Small deterministic-ish jitter so a manual refresh visibly changes something,
// proving the click actually re-fetched rather than re-rendering stale data.
systemStatusRouter.get("/services", (_req, res) => {
  const services = baseServices.map((s) => ({
    ...s,
    latency:
      s.baseLatency === 0
        ? "--"
        : `${Math.max(1, Math.round(s.baseLatency + (Math.random() * 20 - 10)))}ms`,
  }));
  res.json({ services, refreshedAt: new Date().toISOString() });
});

systemStatusRouter.get("/incidents", (_req, res) => {
  res.json({ incidents });
});
