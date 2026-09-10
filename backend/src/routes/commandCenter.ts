import { Router } from "express";
import { batchQuery, run } from "../db/d1.js";
import { toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";
import { isConfigured as sapConfigured, pingSapSandbox } from "../services/sapSandbox.js";

export const commandCenterRouter = Router();

/**
 * Executive KPIs for the home screen.
 *
 * The dashboard previously counted operational things (batches, shipments).
 * The metric an executive actually steers on is financial: what capital is
 * exposed to expiry, and what interventions have already saved. Both come
 * from expiry_risk_snapshots so they are a real series, not a number the UI
 * computed once and cannot chart.
 */

/** Range keys the UI offers, mapped to a SQLite date modifier. */
const RANGES: Record<string, string> = {
  today: "-0 days",
  "7d": "-7 days",
  "30d": "-30 days",
  qtd: "-90 days",
};

interface SnapshotRow {
  as_of: string;
  gross_value_at_risk_minor: number;
  capital_saved_minor: number;
  units_at_risk: number;
}
interface ExcursionRow { mean_variance_c: number | null; excursions: number }
interface SyncRow { system: string; last_sync_at: string; latency_ms: number; status: string }

commandCenterRouter.get("/kpis", async (req, res) => {
  const rangeKey = typeof req.query.range === "string" && req.query.range in RANGES
    ? req.query.range
    : "30d";
  const modifier = RANGES[rangeKey];
  const regionParam = typeof req.query.region === "string" && req.query.region !== "all"
    ? req.query.region
    : null;

  // Region filter is the union of the explicit picker and the caller's own
  // scope; the picker can narrow but never widen what the scope allows.
  const scope = regionScope(req.user, "region_id");

  try {
    // Real network round trip to the SAP Business Accelerator Hub sandbox,
    // timed for real - not a seeded random latency figure. Runs alongside
    // the D1 reads rather than before them, so it costs nothing extra when
    // SAP_SANDBOX_API_KEY isn't set (the seeded rows below stand as-is).
    const sapPing = sapConfigured() ? pingSapSandbox() : null;

    const [series, excursion, syncs] = await batchQuery<
      [SnapshotRow[], ExcursionRow[], SyncRow[]]
    >([
      {
        sql: `SELECT as_of,
                     SUM(gross_value_at_risk_minor) AS gross_value_at_risk_minor,
                     SUM(capital_saved_minor)       AS capital_saved_minor,
                     SUM(units_at_risk)             AS units_at_risk
                FROM expiry_risk_snapshots
               WHERE as_of >= date('now', ?)
                 AND (? IS NULL OR region_id = ?)
                 ${scope.clause}
               GROUP BY as_of
               ORDER BY as_of`,
        params: [modifier, regionParam, regionParam, ...scope.params],
      },
      {
        // Mean deviation from the midpoint of each shipment's allowed band,
        // across readings in the window. This is the cold-chain variance KPI.
        sql: `SELECT AVG(ABS(lr.temp_c - ((s.temp_min_c + s.temp_max_c) / 2.0)))
                       AS mean_variance_c,
                     SUM(CASE WHEN lr.temp_c < s.temp_min_c OR lr.temp_c > s.temp_max_c
                              THEN 1 ELSE 0 END) AS excursions
                FROM logger_readings lr
                JOIN iot_loggers l  ON l.id = lr.logger_id
                JOIN shipments   s  ON s.id = l.shipment_id
               WHERE lr.recorded_at >= datetime('now', ?)
                 AND (? IS NULL OR s.region_id = ?)`,
        params: [modifier, regionParam, regionParam],
      },
      {
        // Newest row per system - the freshness indicator.
        sql: `SELECT e.system, e.last_sync_at, e.latency_ms, e.status
                FROM erp_sync_status e
                JOIN (SELECT system, MAX(recorded_at) AS m
                        FROM erp_sync_status GROUP BY system) x
                  ON x.system = e.system AND x.m = e.recorded_at
               ORDER BY e.system`,
        params: [],
      },
    ]);

    const latest = series[series.length - 1];
    const first = series[0];
    const gver = latest?.gross_value_at_risk_minor ?? 0;
    const saved = latest?.capital_saved_minor ?? 0;

    // Percentage movement across the window, guarded against a zero baseline.
    const pct = (now: number, then: number) =>
      then === 0 ? null : Number((((now - then) / then) * 100).toFixed(1));

    const erpSync = syncs.map((s) => ({
      system: s.system,
      lastSyncAt: toIso(s.last_sync_at),
      latencyMs: s.latency_ms,
      status: s.status,
      isLive: false,
    }));

    if (sapPing) {
      const ping = await sapPing;
      const nowIso = new Date().toISOString();
      // Persist so the next load's "newest row per system" SELECT sees it
      // too, not just this response. Awaited (not fire-and-forget) because a
      // serverless invocation can be torn down the instant the response is
      // sent, before a background write lands.
      try {
        await run(
          `INSERT INTO erp_sync_status (system, last_sync_at, latency_ms, records_synced, status)
                VALUES ('SAP S/4HANA (live sandbox)', ?, ?, ?, ?)`,
          [nowIso, ping.latencyMs, ping.recordsSynced, ping.status]
        );
      } catch (cause) {
        console.error("[command-center] sap ping persist failed:", cause);
      }

      const live = {
        system: "SAP S/4HANA (live sandbox)",
        lastSyncAt: nowIso,
        latencyMs: ping.latencyMs,
        status: ping.status,
        isLive: true,
      };
      const idx = erpSync.findIndex((s) => s.system === live.system);
      if (idx >= 0) erpSync[idx] = live;
      else erpSync.unshift(live);
    }

    res.json({
      range: rangeKey,
      region: regionParam ?? "all",
      grossValueAtRisk: {
        valueMinor: gver,
        unitsAtRisk: latest?.units_at_risk ?? 0,
        changePct: pct(gver, first?.gross_value_at_risk_minor ?? 0),
        windowDays: 150,
      },
      capitalSaved: {
        valueMinor: saved,
        changePct: pct(saved, first?.capital_saved_minor ?? 0),
      },
      coldChain: {
        meanExcursionVarianceC: excursion[0]?.mean_variance_c
          ? Number(excursion[0].mean_variance_c.toFixed(2))
          : 0,
        excursionReadings: excursion[0]?.excursions ?? 0,
      },
      erpSync,
      series: series.map((s) => ({
        date: s.as_of,
        valueAtRiskMinor: s.gross_value_at_risk_minor,
        capitalSavedMinor: s.capital_saved_minor,
      })),
    });
  } catch (cause) {
    console.error("[command-center] kpis failed:", cause);
    res.status(503).json({ detail: "Could not load command centre KPIs" });
  }
});

/** Region list for the global filter, so the UI never hardcodes them. */
commandCenterRouter.get("/regions", async (_req, res) => {
  try {
    const [regions] = await batchQuery<[{ id: string; name: string }[]]>([
      { sql: `SELECT id, name FROM regions ORDER BY name`, params: [] },
    ]);
    res.json({ regions });
  } catch (cause) {
    console.error("[command-center] regions failed:", cause);
    res.status(503).json({ detail: "Could not load regions" });
  }
});
