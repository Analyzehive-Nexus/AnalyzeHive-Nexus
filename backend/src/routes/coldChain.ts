import { Router } from "express";
import { batchQuery, query } from "../db/d1.js";
import { toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";
import { pageLimit } from "../db/paging.js";

export const coldChainRouter = Router();

/**
 * Live cold-chain telemetry and in-transit fleet tracking.
 *
 * This replaces the server-infrastructure telemetry the Live Operations screen
 * used to show (nodes, network throughput). For a pharmaceutical operation the
 * live picture that matters is where the stock is and whether it has stayed
 * inside its temperature band.
 */

interface ShipmentRow {
  id: string; carrier: string | null; mode: string; status: string;
  temp_min_c: number | null; temp_max_c: number | null;
  departed_at: string | null; eta: string | null;
  origin_name: string | null; destination_name: string | null;
  region_name: string | null;
  logger_count: number; last_temp_c: number | null; last_ping_at: string | null;
  last_lat: number | null; last_lng: number | null;
  open_anomalies: number;
  /** Minutes the payload has spent outside its band on this journey. */
  excursion_readings: number;
}

coldChainRouter.get("/shipments", async (req, res) => {
  const scope = regionScope(req.user, "region_id");
  // Narrow first: each shipment row fans out into six correlated subqueries,
  // one of them over the whole logger_readings series.
  const limit = pageLimit(req, 60, 200);
  try {
    const rows = await query<ShipmentRow>(
      `SELECT s.id, s.carrier, s.mode, s.status, s.temp_min_c, s.temp_max_c,
              s.departed_at, s.eta,
              o.name AS origin_name, d.name AS destination_name,
              r.name AS region_name,
              (SELECT COUNT(*) FROM iot_loggers l WHERE l.shipment_id = s.id)
                AS logger_count,
              (SELECT l.last_temp_c FROM iot_loggers l
                WHERE l.shipment_id = s.id ORDER BY l.last_ping_at DESC LIMIT 1)
                AS last_temp_c,
              (SELECT l.last_ping_at FROM iot_loggers l
                WHERE l.shipment_id = s.id ORDER BY l.last_ping_at DESC LIMIT 1)
                AS last_ping_at,
              (SELECT l.last_lat FROM iot_loggers l
                WHERE l.shipment_id = s.id ORDER BY l.last_ping_at DESC LIMIT 1)
                AS last_lat,
              (SELECT l.last_lng FROM iot_loggers l
                WHERE l.shipment_id = s.id ORDER BY l.last_ping_at DESC LIMIT 1)
                AS last_lng,
              (SELECT COUNT(*) FROM route_anomalies a
                WHERE a.shipment_id = s.id AND a.resolved_at IS NULL)
                AS open_anomalies,
              (SELECT COUNT(*) FROM logger_readings lr
                 JOIN iot_loggers l2 ON l2.id = lr.logger_id
                WHERE l2.shipment_id = s.id
                  AND (lr.temp_c < s.temp_min_c OR lr.temp_c > s.temp_max_c))
                AS excursion_readings
         FROM (SELECT * FROM shipments
                WHERE 1 = 1 ${scope.clause}
                ORDER BY (status = 'delivered'), eta
                LIMIT ?) s
         LEFT JOIN warehouses o ON o.id = s.origin_id
         LEFT JOIN warehouses d ON d.id = s.destination_id
         LEFT JOIN regions    r ON r.id = s.region_id
        ORDER BY (s.status = 'delivered'), s.eta`,
      [...scope.params, limit]
    );

    res.json({
      shipments: rows.map((r) => ({
        id: r.id,
        carrier: r.carrier,
        mode: r.mode,
        status: r.status,
        tempBand: { minC: r.temp_min_c, maxC: r.temp_max_c },
        origin: r.origin_name,
        destination: r.destination_name,
        region: r.region_name,
        departedAt: toIso(r.departed_at),
        eta: toIso(r.eta),
        loggerCount: r.logger_count,
        lastTempC: r.last_temp_c,
        lastPingAt: toIso(r.last_ping_at),
        position: r.last_lat !== null && r.last_lng !== null
          ? { lat: r.last_lat, lng: r.last_lng }
          : null,
        openAnomalies: r.open_anomalies,
        // A reading outside the band is what makes this an excursion; the UI
        // shows the count rather than re-deriving it from the series.
        excursionReadings: r.excursion_readings,
        inBand: r.excursion_readings === 0,
      })),
    });
  } catch (cause) {
    console.error("[cold-chain] shipments failed:", cause);
    res.status(503).json({ detail: "Could not load shipments" });
  }
});

interface SummaryRow { total: number; reporting: number; silent: number; low_battery: number }
interface AnomalyRow {
  id: number; shipment_id: string; kind: string; severity: string;
  detail: string; detected_at: string; resolved_at: string | null;
}

coldChainRouter.get("/summary", async (_req, res) => {
  try {
    const [loggers, anomalies, transit] = await batchQuery<
      [SummaryRow[], AnomalyRow[], { in_transit: number; exception: number }[]]
    >([
      {
        sql: `SELECT COUNT(*) AS total,
                     SUM(CASE WHEN status = 'reporting' THEN 1 ELSE 0 END) AS reporting,
                     SUM(CASE WHEN status = 'silent'    THEN 1 ELSE 0 END) AS silent,
                     SUM(CASE WHEN battery_pct < 25     THEN 1 ELSE 0 END) AS low_battery
                FROM iot_loggers WHERE status <> 'retired'`,
        params: [],
      },
      {
        sql: `SELECT id, shipment_id, kind, severity, detail, detected_at, resolved_at
                FROM route_anomalies
               WHERE resolved_at IS NULL
               ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                                      WHEN 'medium' THEN 2 ELSE 3 END,
                        detected_at DESC
               LIMIT 50`,
        params: [],
      },
      {
        sql: `SELECT SUM(CASE WHEN status IN ('in_transit','customs') THEN 1 ELSE 0 END) AS in_transit,
                     SUM(CASE WHEN status = 'exception' THEN 1 ELSE 0 END) AS exception
                FROM shipments`,
        params: [],
      },
    ]);

    res.json({
      loggers: {
        total: loggers[0]?.total ?? 0,
        reporting: loggers[0]?.reporting ?? 0,
        silent: loggers[0]?.silent ?? 0,
        lowBattery: loggers[0]?.low_battery ?? 0,
      },
      shipments: {
        inTransit: transit[0]?.in_transit ?? 0,
        exceptions: transit[0]?.exception ?? 0,
      },
      anomalies: anomalies.map((a) => ({
        id: a.id,
        shipmentId: a.shipment_id,
        kind: a.kind,
        severity: a.severity,
        detail: a.detail,
        detectedAt: toIso(a.detected_at),
      })),
    });
  } catch (cause) {
    console.error("[cold-chain] summary failed:", cause);
    res.status(503).json({ detail: "Could not load cold chain summary" });
  }
});

/** Temperature series for one shipment, for the excursion chart. */
coldChainRouter.get("/shipments/:id/readings", async (req, res) => {
  try {
    const rows = await query<{ temp_c: number; recorded_at: string; logger_id: string }>(
      `SELECT lr.temp_c, lr.recorded_at, lr.logger_id
         FROM logger_readings lr
         JOIN iot_loggers l ON l.id = lr.logger_id
        WHERE l.shipment_id = ?
        ORDER BY lr.recorded_at`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ detail: "No readings" });
    res.json({
      readings: rows.map((r) => ({
        loggerId: r.logger_id,
        tempC: r.temp_c,
        recordedAt: toIso(r.recorded_at),
      })),
    });
  } catch (cause) {
    console.error("[cold-chain] readings failed:", cause);
    res.status(503).json({ detail: "Could not load readings" });
  }
});
