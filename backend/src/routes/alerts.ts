import { Router } from "express";
import { first, query } from "../db/d1.js";
import { toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";

export const alertsRouter = Router();

interface AlertRow {
  id: number;
  level: string;
  title: string;
  description: string;
  detail: string | null;
  region_id: string | null;
  created_at: string;
}

function shape(row: AlertRow) {
  return {
    id: row.id,
    level: row.level,
    title: row.title,
    desc: row.description,
    detail: row.detail ?? "",
    region: row.region_id,
    createdAt: toIso(row.created_at),
  };
}

const COLUMNS = `id, level, title, description, detail, region_id, created_at`;

// Open alerts only: a resolved alert stays in the table for history but is not
// an "active risk" the dashboard should count.
alertsRouter.get("/", async (req, res) => {
  const scope = regionScope(req.user, "region_id");
  try {
    const rows = await query<AlertRow>(
      `SELECT ${COLUMNS}
         FROM alerts
        WHERE resolved_at IS NULL ${scope.clause}
        ORDER BY created_at DESC, id DESC
        LIMIT 100`,
      scope.params
    );
    res.json({ alerts: rows.map(shape) });
  } catch (cause) {
    console.error("[alerts] list failed:", cause);
    res.status(503).json({ detail: "Could not load alerts" });
  }
});

alertsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  // Guard before the round trip: '1e3' and '  1  ' both coerce to numbers that
  // are not the id anyone typed, and a NaN would reach D1 as null.
  if (!Number.isInteger(id)) {
    return res.status(400).json({ detail: "Alert id must be an integer" });
  }

  const scope = regionScope(req.user, "region_id");
  try {
    const row = await first<AlertRow>(
      `SELECT ${COLUMNS} FROM alerts WHERE id = ? ${scope.clause}`,
      [id, ...scope.params]
    );
    if (!row) {
      // Out-of-scope reads 404 rather than 403 - a 403 would confirm the row
      // exists, which is the thing scoping is meant to hide.
      return res.status(404).json({ detail: "Alert not found" });
    }
    res.json(shape(row));
  } catch (cause) {
    console.error("[alerts] fetch failed:", cause);
    res.status(503).json({ detail: "Could not load alert" });
  }
});
