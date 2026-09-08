import { Router } from "express";
import { batchQuery, query } from "../db/d1.js";
import { toBool, toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";

export const commercialTruthRouter = Router();

interface RepRow {
  id: string;
  name: string;
  title: string;
  initials: string;
  color: string | null;
  team_size: number;
  manager_id: string | null;
  region_id: string | null;
  region_name: string | null;
  reported: number | null;
  verified: number | null;
  status: string | null;
}

interface RegionRow {
  id: string;
  name: string;
}

/**
 * Metrics are per-period, so the join has to name one. The current calendar
 * month matches how the rows are seeded; a rep with no row for it comes back
 * with null metrics rather than dropping out of the hierarchy entirely.
 */
commercialTruthRouter.get("/hierarchy", async (req, res) => {
  const region = String(req.query.region ?? "all").trim();
  const scope = regionScope(req.user, "f.region_id");

  // The UI filters by display name ('North'); the column holds an id
  // ('north'). Matching either keeps both callers working.
  const filter =
    region && region.toLowerCase() !== "all"
      ? `AND (f.region_id = ? OR r.name = ?)`
      : "";
  const filterParams = filter ? [region.toLowerCase(), region] : [];

  try {
    const [reps, regions] = await batchQuery<[RepRow[], RegionRow[]]>([
      {
        sql: `SELECT f.id, f.name, f.title, f.initials, f.color, f.team_size,
                     f.manager_id, f.region_id, r.name AS region_name,
                     m.reported, m.verified, m.status
                FROM field_reps f
                LEFT JOIN regions r ON r.id = f.region_id
                LEFT JOIN rep_metrics m
                       ON m.rep_id = f.id AND m.period = strftime('%Y-%m', 'now')
               WHERE 1 = 1 ${scope.clause} ${filter}
               ORDER BY (m.status = 'Flagged') DESC, m.reported DESC, f.name`,
        params: [...scope.params, ...filterParams],
      },
      { sql: `SELECT id, name FROM regions ORDER BY name`, params: [] },
    ]);

    res.json({
      hierarchy: reps.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.title,
        teamSize: row.team_size,
        initials: row.initials,
        color: row.color ?? "bg-slate-500",
        reported: row.reported ?? 0,
        verified: row.verified ?? 0,
        status: row.status ?? "Pending",
        region: row.region_name ?? "Unassigned",
        // The page is called a hierarchy audit; this is what makes the flat
        // list an actual tree when the UI is ready to render one.
        managerId: row.manager_id,
      })),
      regions: regions.map((r) => r.name),
    });
  } catch (cause) {
    console.error("[commercial-truth] hierarchy failed:", cause);
    res.status(503).json({ detail: "Could not load hierarchy" });
  }
});

interface AuditRow {
  id: number;
  event: string;
  flagged: number;
  occurred_at: string;
}

commercialTruthRouter.get("/audit/:id/log", async (req, res) => {
  try {
    const rows = await query<AuditRow>(
      `SELECT id, event, flagged, occurred_at
         FROM audit_events
        WHERE rep_id = ?
        ORDER BY occurred_at, id`,
      [req.params.id]
    );
    res.json({
      id: req.params.id,
      log: rows.map((row) => ({
        id: row.id,
        event: row.event,
        flagged: toBool(row.flagged),
        occurredAt: toIso(row.occurred_at),
      })),
    });
  } catch (cause) {
    console.error("[commercial-truth] audit log failed:", cause);
    res.status(503).json({ detail: "Could not load audit log" });
  }
});

// ===========================================================================
// Field-force integrity: geo-fencing, doctor-chemist triangulation, call
// audio, and objection analysis. Added alongside the hierarchy audit above.
// ===========================================================================

interface VisitRow {
  id: string; visited_at: string; distance_m: number | null;
  geo_verified: number; spoof_score: number;
  rep_name: string; rep_id: string;
  hcp_name: string; clinic_name: string | null; geofence_radius_m: number;
  recording_id: string | null;
  /** Units dispensed by linked stockists in the 7 days after the visit. */
  units_after: number | null;
  /** Same window, immediately before - the triangulation baseline. */
  units_before: number | null;
}

/**
 * A rep claiming a visit is not evidence the visit happened. Two independent
 * checks are joined here: whether the device ping fell inside the clinic's
 * geofence, and whether secondary sales at the linked stockist actually moved
 * afterwards. A visit that passes neither is the interesting case.
 */
commercialTruthRouter.get("/visits", async (req, res) => {
  const scope = regionScope(req.user, "v.region_id");
  const onlyFlagged = req.query.flagged === "1";
  try {
    const rows = await query<VisitRow>(
      `SELECT v.id, v.visited_at, v.distance_m, v.geo_verified, v.spoof_score,
              v.rep_id, fr.name AS rep_name,
              h.name AS hcp_name, h.clinic_name, h.geofence_radius_m,
              (SELECT cr.id FROM call_recordings cr WHERE cr.visit_id = v.id LIMIT 1)
                AS recording_id,
              (SELECT COALESCE(SUM(ss.units), 0) FROM stockist_sales ss
                WHERE ss.hcp_id = v.hcp_id
                  AND ss.sold_on >  date(v.visited_at)
                  AND ss.sold_on <= date(v.visited_at, '+7 days')) AS units_after,
              (SELECT COALESCE(SUM(ss.units), 0) FROM stockist_sales ss
                WHERE ss.hcp_id = v.hcp_id
                  AND ss.sold_on <= date(v.visited_at)
                  AND ss.sold_on >  date(v.visited_at, '-7 days')) AS units_before
         FROM hcp_visits v
         JOIN field_reps fr ON fr.id = v.rep_id
         JOIN hcps h        ON h.id  = v.hcp_id
        WHERE 1 = 1 ${scope.clause}
          AND (? = 0 OR v.geo_verified = 0)
        ORDER BY v.visited_at DESC`,
      [...scope.params, onlyFlagged ? 1 : 0]
    );

    res.json({
      visits: rows.map((r) => {
        const before = r.units_before ?? 0;
        const after = r.units_after ?? 0;
        return {
          id: r.id,
          visitedAt: toIso(r.visited_at),
          repId: r.rep_id,
          repName: r.rep_name,
          hcpName: r.hcp_name,
          clinicName: r.clinic_name,
          geo: {
            verified: toBool(r.geo_verified),
            distanceM: r.distance_m,
            geofenceRadiusM: r.geofence_radius_m,
            spoofScore: r.spoof_score,
          },
          triangulation: {
            unitsBefore: before,
            unitsAfter: after,
            // Null rather than 0 when there is no baseline: "no prior sales"
            // is not the same as "no lift", and charting it as 0% would lie.
            liftPct: before === 0 ? null : Number((((after - before) / before) * 100).toFixed(1)),
          },
          recordingId: r.recording_id,
        };
      }),
    });
  } catch (cause) {
    console.error("[commercial-truth] visits failed:", cause);
    res.status(503).json({ detail: "Could not load visits" });
  }
});

interface RecordingRow {
  id: string; duration_ms: number; audio_url: string | null;
  waveform: string | null; transcribed_at: string | null;
}
interface SnippetRow {
  id: number; start_ms: number; end_ms: number; label: string;
  transcript: string | null; severity: string;
}

/** Waveform envelope plus flagged snippet timestamps for the audio player. */
commercialTruthRouter.get("/visits/:id/recording", async (req, res) => {
  try {
    const [recs, snippets] = await batchQuery<[RecordingRow[], SnippetRow[]]>([
      {
        sql: `SELECT id, duration_ms, audio_url, waveform, transcribed_at
                FROM call_recordings WHERE visit_id = ? LIMIT 1`,
        params: [req.params.id],
      },
      {
        sql: `SELECT s.id, s.start_ms, s.end_ms, s.label, s.transcript, s.severity
                FROM call_snippets s
                JOIN call_recordings r ON r.id = s.recording_id
               WHERE r.visit_id = ?
               ORDER BY s.start_ms`,
        params: [req.params.id],
      },
    ]);

    const rec = recs[0];
    if (!rec) return res.status(404).json({ detail: "No recording for this visit" });

    let waveform: number[] = [];
    if (rec.waveform) {
      try {
        const parsed: unknown = JSON.parse(rec.waveform);
        if (Array.isArray(parsed)) waveform = parsed.filter((n): n is number => typeof n === "number");
      } catch {
        // Envelope is a rendering nicety; a bad one should not 500 the panel.
        console.warn("[commercial-truth] unparseable waveform on", rec.id);
      }
    }

    res.json({
      id: rec.id,
      durationMs: rec.duration_ms,
      audioUrl: rec.audio_url,
      transcribedAt: toIso(rec.transcribed_at),
      waveform,
      snippets: snippets.map((s) => ({
        id: s.id,
        startMs: s.start_ms,
        endMs: s.end_ms,
        label: s.label,
        transcript: s.transcript,
        severity: s.severity,
      })),
    });
  } catch (cause) {
    console.error("[commercial-truth] recording failed:", cause);
    res.status(503).json({ detail: "Could not load recording" });
  }
});

/** Objection categories, so resistance can be coached against by type. */
commercialTruthRouter.get("/objections", async (_req, res) => {
  try {
    const rows = await query<{ category: string; total: number; handled: number }>(
      `SELECT category, COUNT(*) AS total,
              SUM(CASE WHEN handled = 1 THEN 1 ELSE 0 END) AS handled
         FROM hcp_objections
        GROUP BY category
        ORDER BY total DESC`
    );
    res.json({
      objections: rows.map((r) => ({
        category: r.category,
        total: r.total,
        handled: r.handled,
        handledPct: r.total === 0 ? 0 : Number(((r.handled / r.total) * 100).toFixed(1)),
      })),
    });
  } catch (cause) {
    console.error("[commercial-truth] objections failed:", cause);
    res.status(503).json({ detail: "Could not load objections" });
  }
});

interface EffRow {
  rep_id: string; rep_name: string; dpri: number;
  geo_spoof_rate_pct: number; conversions: number; detractions: number;
}

/** DPRI, geo-spoofing rate and the detraction/conversion ratio, per rep. */
commercialTruthRouter.get("/effectiveness", async (_req, res) => {
  try {
    const rows = await query<EffRow>(
      `SELECT e.rep_id, fr.name AS rep_name, e.dpri, e.geo_spoof_rate_pct,
              e.conversions, e.detractions
         FROM rep_effectiveness e
         JOIN field_reps fr ON fr.id = e.rep_id
        WHERE e.period = strftime('%Y-%m', 'now')
        ORDER BY e.dpri DESC`
    );
    res.json({
      reps: rows.map((r) => ({
        repId: r.rep_id,
        repName: r.rep_name,
        // 100 = no change in prescribing after the visit.
        dpri: r.dpri,
        geoSpoofRatePct: r.geo_spoof_rate_pct,
        conversions: r.conversions,
        detractions: r.detractions,
        // Guard the divide: a rep with no detractions is not "infinity good".
        conversionRatio: r.detractions === 0
          ? null
          : Number((r.conversions / r.detractions).toFixed(2)),
      })),
    });
  } catch (cause) {
    console.error("[commercial-truth] effectiveness failed:", cause);
    res.status(503).json({ detail: "Could not load effectiveness" });
  }
});
