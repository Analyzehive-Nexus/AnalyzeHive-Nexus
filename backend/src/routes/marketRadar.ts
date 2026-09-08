import { Router } from "express";
import { query } from "../db/d1.js";
import { likePattern, toBool, toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";
import { pageLimit } from "../db/paging.js";

export const marketRadarRouter = Router();

interface SignalRow {
  id: number;
  source: string;
  title: string;
  sentiment: string;
  impact: string;
  detected_at: string;
}

marketRadarRouter.get("/signals", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const scope = regionScope(req.user, "region_id");

  // ESCAPE '\' pairs with likePattern(): without it a search for "50%" means
  // "50 followed by anything" and matches every row.
  const search = q ? `AND (title LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\')` : "";
  const searchParams = q ? [likePattern(q), likePattern(q)] : [];

  try {
    const rows = await query<SignalRow>(
      `SELECT id, source, title, sentiment, impact, detected_at
         FROM market_signals
        WHERE 1 = 1 ${scope.clause} ${search}
        ORDER BY detected_at DESC, id DESC
        LIMIT 100`,
      [...scope.params, ...searchParams]
    );
    res.json({
      signals: rows.map((row) => ({
        id: row.id,
        source: row.source,
        title: row.title,
        sentiment: row.sentiment,
        impact: row.impact,
        detectedAt: toIso(row.detected_at),
      })),
    });
  } catch (cause) {
    console.error("[market-radar] signals failed:", cause);
    res.status(503).json({ detail: "Could not load signals" });
  }
});

interface AnalysisRow {
  id: number;
  summary: string;
  recommendation: string;
  generated_at: string;
  activity: string | null;
}

// No analysis on record is a normal state for a node nobody has run yet, so it
// is a 200 with an empty reading rather than a 404 the UI would have to special
// case.
const NO_ANALYSIS = {
  summary: "No significant signals detected for this entity in the past 24h.",
  recentActivity: [] as string[],
  recommendation: "Continue routine monitoring.",
  generatedAt: null as string | null,
};

/**
 * Analyses are versioned (one row per run, newest wins) so a regenerated
 * analysis does not destroy the previous one. The subquery picks the newest
 * id, and the join pulls its activity lines in the same round trip.
 */
marketRadarRouter.get("/nodes/:id/analysis", async (req, res) => {
  try {
    const rows = await query<AnalysisRow>(
      `SELECT a.id, a.summary, a.recommendation, a.generated_at, act.activity
         FROM node_analyses a
         LEFT JOIN node_analysis_activity act ON act.analysis_id = a.id
        WHERE a.id = (SELECT id FROM node_analyses
                       WHERE node_id = ?
                       ORDER BY generated_at DESC, id DESC
                       LIMIT 1)
        ORDER BY act.ordinal`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json(NO_ANALYSIS);
    }

    res.json({
      summary: rows[0].summary,
      recommendation: rows[0].recommendation,
      generatedAt: toIso(rows[0].generated_at),
      // The LEFT JOIN yields one row with a null activity when an analysis has
      // no activity lines at all.
      recentActivity: rows.map((r) => r.activity).filter((a): a is string => a !== null),
    });
  } catch (cause) {
    console.error("[market-radar] node analysis failed:", cause);
    res.status(503).json({ detail: "Could not load analysis" });
  }
});

// ===========================================================================
// Competitive intelligence that is specific to pharma: exclusivity expiry,
// regulator price action, formulary movement, share of voice and pipeline
// velocity. A generic "signals" feed cannot answer any of these.
// ===========================================================================

interface PatentRow {
  id: string; molecule: string; brand: string | null; holder: string;
  market: string; exclusivity_type: string; expiry_date: string;
  annual_value_minor: number; therapeutic_area: string | null;
  days_to_expiry: number;
}

/**
 * Patent cliff / loss-of-exclusivity countdown.
 *
 * Days are computed per query so the countdown actually counts down, the same
 * rule the expiry watchlist follows. A negative value means exclusivity has
 * already lapsed and generics can enter.
 */
marketRadarRouter.get("/patents", async (req, res) => {
  const limit = pageLimit(req, 100, 500);
  try {
    const rows = await query<PatentRow>(
      `SELECT id, molecule, brand, holder, market, exclusivity_type,
              expiry_date, annual_value_minor, therapeutic_area,
              CAST(julianday(expiry_date) - julianday('now') AS INTEGER)
                AS days_to_expiry
         FROM patents
        ORDER BY days_to_expiry
        LIMIT ${limit}`
    );
    res.json({
      patents: rows.map((r) => ({
        id: r.id,
        molecule: r.molecule,
        brand: r.brand,
        holder: r.holder,
        market: r.market,
        exclusivityType: r.exclusivity_type,
        expiryDate: r.expiry_date,
        daysToExpiry: r.days_to_expiry,
        annualValueMinor: r.annual_value_minor,
        therapeuticArea: r.therapeutic_area,
        lapsed: r.days_to_expiry < 0,
      })),
    });
  } catch (cause) {
    console.error("[market-radar] patents failed:", cause);
    res.status(503).json({ detail: "Could not load patent data" });
  }
});

interface RegRow {
  id: number; authority: string; kind: string; product: string;
  ceiling_price_minor: number | null; previous_price_minor: number | null;
  detail: string | null; effective_from: string; published_at: string;
}

/** DPCO/NPPA ceiling prices and FDA/EMA/CDSCO events as one feed. */
marketRadarRouter.get("/regulatory", async (req, res) => {
  const limit = pageLimit(req, 100, 500);
  try {
    const rows = await query<RegRow>(
      `SELECT id, authority, kind, product, ceiling_price_minor,
              previous_price_minor, detail, effective_from, published_at
         FROM regulatory_events
        ORDER BY published_at DESC
        LIMIT ${limit}`
    );
    res.json({
      events: rows.map((r) => {
        const now = r.ceiling_price_minor;
        const then = r.previous_price_minor;
        return {
          id: r.id,
          authority: r.authority,
          kind: r.kind,
          product: r.product,
          ceilingPriceMinor: now,
          previousPriceMinor: then,
          // Only a price event has a delta; an approval has none.
          changePct: now !== null && then !== null && then !== 0
            ? Number((((now - then) / then) * 100).toFixed(1))
            : null,
          detail: r.detail,
          effectiveFrom: r.effective_from,
          publishedAt: toIso(r.published_at),
        };
      }),
    });
  } catch (cause) {
    console.error("[market-radar] regulatory failed:", cause);
    res.status(503).json({ detail: "Could not load regulatory events" });
  }
});

/** Formulary tier movement. Tier 1 is the most favourable placement. */
marketRadarRouter.get("/formulary", async (req, res) => {
  const limit = pageLimit(req, 100, 500);
  try {
    const rows = await query<{
      id: number; network: string; product: string; tier: number;
      previous_tier: number | null; changed_at: string; region_name: string | null;
    }>(
      `SELECT f.id, f.network, f.product, f.tier, f.previous_tier,
              f.changed_at, r.name AS region_name
         FROM formulary_placements f
         LEFT JOIN regions r ON r.id = f.region_id
        ORDER BY f.changed_at DESC
        LIMIT ${limit}`
    );
    res.json({
      placements: rows.map((r) => ({
        id: r.id,
        network: r.network,
        product: r.product,
        tier: r.tier,
        previousTier: r.previous_tier,
        // Lower tier number is better, so a decrease is a promotion.
        direction: r.previous_tier === null || r.previous_tier === r.tier
          ? "unchanged"
          : r.tier < r.previous_tier ? "promoted" : "demoted",
        changedAt: toIso(r.changed_at),
        region: r.region_name,
      })),
    });
  } catch (cause) {
    console.error("[market-radar] formulary failed:", cause);
    res.status(503).json({ detail: "Could not load formulary placements" });
  }
});

/** Share of voice by therapeutic area for the current period. */
marketRadarRouter.get("/share-of-voice", async (req, res) => {
  const limit = pageLimit(req, 300, 1000);
  try {
    const rows = await query<{
      therapeutic_area: string; company: string; sov_pct: number; is_own: number;
    }>(
      `SELECT therapeutic_area, company, sov_pct, is_own
         FROM share_of_voice
        WHERE period = strftime('%Y-%m', 'now')
        ORDER BY therapeutic_area, sov_pct DESC
        LIMIT ${limit}`
    );

    // Group in the API rather than making the UI pivot a flat list.
    const areas = new Map<string, { company: string; sovPct: number; isOwn: boolean }[]>();
    for (const r of rows) {
      const list = areas.get(r.therapeutic_area) ?? [];
      list.push({ company: r.company, sovPct: r.sov_pct, isOwn: toBool(r.is_own) });
      areas.set(r.therapeutic_area, list);
    }

    res.json({
      areas: [...areas.entries()].map(([therapeuticArea, companies]) => ({
        therapeuticArea,
        companies,
        ownSovPct: companies.find((c) => c.isOwn)?.sovPct ?? null,
      })),
    });
  } catch (cause) {
    console.error("[market-radar] share of voice failed:", cause);
    res.status(503).json({ detail: "Could not load share of voice" });
  }
});

/** Pipeline velocity - who is moving through Phase II/III, and how fast. */
marketRadarRouter.get("/trials", async (req, res) => {
  const limit = pageLimit(req, 100, 500);
  try {
    const rows = await query<{
      id: string; sponsor: string; molecule: string; therapeutic_area: string | null;
      phase: string; status: string; started_at: string | null;
      est_completion: string | null; schedule_delta_days: number; is_own: number;
    }>(
      `SELECT id, sponsor, molecule, therapeutic_area, phase, status,
              started_at, est_completion, schedule_delta_days, is_own
         FROM clinical_trials
        ORDER BY CASE phase WHEN 'III' THEN 0 WHEN 'II' THEN 1 WHEN 'I' THEN 2 ELSE 3 END,
                 schedule_delta_days
        LIMIT ${limit}`
    );
    res.json({
      trials: rows.map((r) => ({
        id: r.id,
        sponsor: r.sponsor,
        molecule: r.molecule,
        therapeuticArea: r.therapeutic_area,
        phase: r.phase,
        status: r.status,
        startedAt: r.started_at,
        estCompletion: r.est_completion,
        // Negative means ahead of the sponsor's original plan.
        scheduleDeltaDays: r.schedule_delta_days,
        accelerating: r.schedule_delta_days < 0,
        isOwn: toBool(r.is_own),
      })),
    });
  } catch (cause) {
    console.error("[market-radar] trials failed:", cause);
    res.status(503).json({ detail: "Could not load clinical trials" });
  }
});
