import { Router } from "express";
import { batchQuery } from "../db/d1.js";
import { toIso } from "../db/rows.js";

export const profileRouter = Router();

interface ActivityRow {
  id: number;
  action: string;
  kind: string;
  occurred_at: string;
}

/**
 * One person's own trail, never the whole table: activity_log has a user_id
 * and this is the only place it is read, so the filter lives here.
 *
 * Rows are written by the sign-in path today; the list is legitimately short
 * on a fresh database rather than pre-populated with someone else's history.
 */
profileRouter.get("/activity", async (req, res) => {
  // Number("abc") is NaN, and Math.max(1, NaN) stays NaN - a NaN LIMIT reaches
  // D1 as null and returns nothing, so a junk limit used to 200 with an empty
  // list. Capped as well: LIMIT comes from the query string.
  const parsed = Number(req.query.limit ?? 4);
  const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.floor(parsed))) : 4;

  try {
    const [rows, totals] = await batchQuery<[ActivityRow[], { total: number }[]]>([
      {
        sql: `SELECT id, action, kind, occurred_at
                FROM activity_log
               WHERE user_id = ?
               ORDER BY occurred_at DESC, id DESC
               LIMIT ?`,
        params: [req.user!.id, limit],
      },
      {
        sql: `SELECT COUNT(*) AS total FROM activity_log WHERE user_id = ?`,
        params: [req.user!.id],
      },
    ]);

    res.json({
      activity: rows.map((row) => ({
        id: row.id,
        action: row.action,
        type: row.kind,
        occurredAt: toIso(row.occurred_at),
      })),
      total: totals[0]?.total ?? 0,
    });
  } catch (cause) {
    console.error("[profile] activity failed:", cause);
    res.status(503).json({ detail: "Could not load activity" });
  }
});
