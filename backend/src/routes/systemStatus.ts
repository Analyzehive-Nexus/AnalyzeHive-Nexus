import { Router } from "express";
import { batchQuery, query } from "../db/d1.js";
import { toIso } from "../db/rows.js";

export const systemStatusRouter = Router();

interface ServiceRow {
  id: number;
  name: string;
  region: string | null;
  status: string;
  uptime_pct: number | null;
  latency_ms: number | null;
  checked_at: string | null;
}

interface IncidentRow {
  id: number;
  title: string;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
}

/**
 * Latency is the newest row from the service_checks time series, not a number
 * invented per request. The prototype jittered a base value with Math.random()
 * so a manual refresh visibly changed something - which meant the page could
 * never show that a probe had stopped reporting. A service with no checks now
 * returns null latency, and the UI renders that as "--".
 */
systemStatusRouter.get("/services", async (_req, res) => {
  try {
    const [services] = await batchQuery<[ServiceRow[]]>([
      {
        sql: `SELECT s.id, s.name, s.region, s.status, s.uptime_pct,
                     c.latency_ms, c.checked_at
                FROM services s
                LEFT JOIN service_checks c
                       ON c.id = (SELECT id FROM service_checks
                                   WHERE service_id = s.id
                                   ORDER BY checked_at DESC, id DESC
                                   LIMIT 1)
               ORDER BY s.id`,
        params: [],
      },
    ]);

    res.json({
      services: services.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        region: row.region ?? "Global",
        uptimePct: row.uptime_pct,
        latencyMs: row.latency_ms,
        checkedAt: toIso(row.checked_at),
      })),
      refreshedAt: new Date().toISOString(),
    });
  } catch (cause) {
    console.error("[system-status] services failed:", cause);
    res.status(503).json({ detail: "Could not load services" });
  }
});

systemStatusRouter.get("/incidents", async (_req, res) => {
  try {
    const [incidents] = await batchQuery<[IncidentRow[]]>([
      {
        sql: `SELECT id, title, severity, status, started_at, resolved_at
                FROM incidents
               ORDER BY started_at DESC, id DESC`,
        params: [],
      },
    ]);

    res.json({
      incidents: incidents.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        status: row.status,
        startedAt: toIso(row.started_at),
        resolvedAt: toIso(row.resolved_at),
      })),
    });
  } catch (cause) {
    console.error("[system-status] incidents failed:", cause);
    res.status(503).json({ detail: "Could not load incidents" });
  }
});

// ===========================================================================
// Platform-specific telemetry: model serving latency and the throughput of
// the distributor ingestion pipeline.
// ===========================================================================

/** Newest sample per model behind Triton. */
systemStatusRouter.get("/inference", async (_req, res) => {
  try {
    const rows = await query<{
      model: string; p50_ms: number; p95_ms: number;
      queue_depth: number; gpu_util_pct: number | null; recorded_at: string;
    }>(
      `SELECT i.model, i.p50_ms, i.p95_ms, i.queue_depth, i.gpu_util_pct, i.recorded_at
         FROM inference_metrics i
         JOIN (SELECT model, MAX(recorded_at) AS m
                 FROM inference_metrics GROUP BY model) x
           ON x.model = i.model AND x.m = i.recorded_at
        ORDER BY i.p95_ms DESC`
    );
    res.json({
      models: rows.map((r) => ({
        model: r.model,
        p50Ms: r.p50_ms,
        p95Ms: r.p95_ms,
        queueDepth: r.queue_depth,
        gpuUtilPct: r.gpu_util_pct,
        recordedAt: toIso(r.recorded_at),
      })),
    });
  } catch (cause) {
    console.error("[system-status] inference failed:", cause);
    res.status(503).json({ detail: "Could not load inference metrics" });
  }
});

/** Records per second and backlog, per ingestion source. */
systemStatusRouter.get("/ingestion", async (_req, res) => {
  try {
    const rows = await query<{
      source: string; records_per_sec: number; backlog_records: number; recorded_at: string;
    }>(
      `SELECT t.source, t.records_per_sec, t.backlog_records, t.recorded_at
         FROM ingestion_throughput t
         JOIN (SELECT source, MAX(recorded_at) AS m
                 FROM ingestion_throughput GROUP BY source) x
           ON x.source = t.source AND x.m = t.recorded_at
        ORDER BY t.records_per_sec DESC`
    );
    res.json({
      sources: rows.map((r) => ({
        source: r.source,
        recordsPerSec: r.records_per_sec,
        backlogRecords: r.backlog_records,
        recordedAt: toIso(r.recorded_at),
      })),
    });
  } catch (cause) {
    console.error("[system-status] ingestion failed:", cause);
    res.status(503).json({ detail: "Could not load ingestion throughput" });
  }
});
