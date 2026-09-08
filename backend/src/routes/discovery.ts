import { Router } from "express";
import { batchQuery, first, query } from "../db/d1.js";
import { toIso } from "../db/rows.js";
import { pageLimit } from "../db/paging.js";

export const discoveryRouter = Router();

/**
 * Drug discovery programmes and their 3D disease models.
 *
 * Model geometry is stored as JSON (see 0003) because it is read whole on
 * every render and never queried by field. It is parsed here rather than in
 * the browser so a malformed row fails as a 503 on our side instead of
 * throwing inside the renderer.
 */

interface ProgramRow {
  id: string; name: string; therapeutic_area: string; target: string | null;
  phase: string; started_at: string | null; ptrs: number | null;
  lead_name: string | null; model_count: number; candidate_count: number;
}

discoveryRouter.get("/programs", async (req, res) => {
  const limit = pageLimit(req, 100, 500);
  try {
    const rows = await query<ProgramRow>(
      `SELECT p.id, p.name, p.therapeutic_area, p.target, p.phase,
              p.started_at, p.ptrs, u.name AS lead_name,
              (SELECT COUNT(*) FROM disease_models m WHERE m.program_id = p.id)
                AS model_count,
              (SELECT COUNT(*) FROM compound_candidates c WHERE c.program_id = p.id)
                AS candidate_count
         FROM discovery_programs p
         LEFT JOIN users u ON u.id = p.lead_user_id
        ORDER BY CASE p.phase
                   WHEN 'submitted' THEN 0 WHEN 'III' THEN 1 WHEN 'II' THEN 2
                   WHEN 'I' THEN 3 WHEN 'preclinical' THEN 4 ELSE 5 END,
                 p.name
        LIMIT ${limit}`
    );

    res.json({
      programs: rows.map((r) => ({
        id: r.id,
        name: r.name,
        therapeuticArea: r.therapeutic_area,
        target: r.target,
        phase: r.phase,
        startedAt: r.started_at,
        // Probability of technical and regulatory success, 0..1.
        ptrs: r.ptrs,
        lead: r.lead_name,
        modelCount: r.model_count,
        candidateCount: r.candidate_count,
      })),
    });
  } catch (cause) {
    console.error("[discovery] programs failed:", cause);
    res.status(503).json({ detail: "Could not load discovery programs" });
  }
});

interface ModelRow {
  id: string; program_id: string | null; name: string; disease: string;
  model_type: string; summary: string | null; nodes: string; edges: string;
  updated_at: string; program_name: string | null;
}

discoveryRouter.get("/models", async (req, res) => {
  const limit = pageLimit(req, 200, 500);
  try {
    const rows = await query<ModelRow>(
      `SELECT m.id, m.program_id, m.name, m.disease, m.model_type, m.summary,
              m.nodes, m.edges, m.updated_at, p.name AS program_name
         FROM disease_models m
         LEFT JOIN discovery_programs p ON p.id = m.program_id
        ORDER BY m.name
        LIMIT ${limit}`
    );
    res.json({
      models: rows.map((r) => ({
        id: r.id,
        name: r.name,
        disease: r.disease,
        modelType: r.model_type,
        program: r.program_name,
        summary: r.summary,
        updatedAt: toIso(r.updated_at),
      })),
    });
  } catch (cause) {
    console.error("[discovery] models failed:", cause);
    res.status(503).json({ detail: "Could not load disease models" });
  }
});

/** Full geometry for one model - what the 3D viewer renders. */
discoveryRouter.get("/models/:id", async (req, res) => {
  try {
    const row = await first<ModelRow>(
      `SELECT m.id, m.program_id, m.name, m.disease, m.model_type, m.summary,
              m.nodes, m.edges, m.updated_at, p.name AS program_name
         FROM disease_models m
         LEFT JOIN discovery_programs p ON p.id = m.program_id
        WHERE m.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ detail: "Model not found" });

    let nodes: unknown;
    let edges: unknown;
    try {
      nodes = JSON.parse(row.nodes);
      edges = JSON.parse(row.edges);
    } catch {
      // json_valid() guards writes, so this means the row was corrupted after
      // insert. Failing here beats handing the renderer something unusable.
      console.error("[discovery] model geometry is not parseable:", row.id);
      return res.status(503).json({ detail: "Model geometry is unreadable" });
    }

    res.json({
      id: row.id,
      name: row.name,
      disease: row.disease,
      modelType: row.model_type,
      program: row.program_name,
      summary: row.summary,
      updatedAt: toIso(row.updated_at),
      nodes,
      edges,
    });
  } catch (cause) {
    console.error("[discovery] model failed:", cause);
    res.status(503).json({ detail: "Could not load model" });
  }
});

interface CandidateRow {
  id: string; program_id: string; code_name: string;
  binding_affinity_nm: number | null; selectivity_fold: number | null;
  admet_score: number | null; status: string; program_name: string;
}

discoveryRouter.get("/candidates", async (req, res) => {
  const programId = typeof req.query.program === "string" ? req.query.program : null;
  const limit = pageLimit(req, 100, 500);
  try {
    const [rows] = await batchQuery<[CandidateRow[]]>([
      {
        sql: `SELECT c.id, c.program_id, c.code_name, c.binding_affinity_nm,
                     c.selectivity_fold, c.admet_score, c.status, p.name AS program_name
                FROM compound_candidates c
                JOIN discovery_programs p ON p.id = c.program_id
               WHERE (? IS NULL OR c.program_id = ?)
               ORDER BY CASE c.status
                          WHEN 'optimised' THEN 0 WHEN 'lead' THEN 1
                          WHEN 'hit' THEN 2 WHEN 'screening' THEN 3 ELSE 4 END,
                        c.binding_affinity_nm
               LIMIT ${limit}`,
        params: [programId, programId],
      },
    ]);
    res.json({
      candidates: rows.map((r) => ({
        id: r.id,
        programId: r.program_id,
        program: r.program_name,
        codeName: r.code_name,
        // Lower nM is a stronger binder - the UI must not sort this ascending
        // as if bigger were better.
        bindingAffinityNm: r.binding_affinity_nm,
        selectivityFold: r.selectivity_fold,
        admetScore: r.admet_score,
        status: r.status,
      })),
    });
  } catch (cause) {
    console.error("[discovery] candidates failed:", cause);
    res.status(503).json({ detail: "Could not load candidates" });
  }
});
