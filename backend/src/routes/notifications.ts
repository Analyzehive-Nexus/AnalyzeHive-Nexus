import { Router } from "express";
import { first, query, run } from "../db/d1.js";
import { toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";

export const notificationsRouter = Router();

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

function shape(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    createdAt: toIso(row.created_at),
    read: row.read_at !== null,
  };
}

/**
 * Read state is per-user (notification_reads), not a column on the
 * notification. The prototype kept one global boolean, so the moment a second
 * account existed both users shared one read state - marking a notification
 * read for yourself marked it read for everyone.
 */
notificationsRouter.get("/", async (req, res) => {
  const scope = regionScope(req.user, "n.region_id");
  try {
    const rows = await query<NotificationRow>(
      `SELECT n.id, n.title, n.message, n.created_at, r.read_at
         FROM notifications n
         LEFT JOIN notification_reads r
                ON r.notification_id = n.id AND r.user_id = ?
        WHERE 1 = 1 ${scope.clause}
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 100`,
      [req.user!.id, ...scope.params]
    );
    const notifications = rows.map(shape);
    res.json({
      notifications,
      unread: notifications.filter((n) => !n.read).length,
    });
  } catch (cause) {
    console.error("[notifications] list failed:", cause);
    res.status(503).json({ detail: "Could not load notifications" });
  }
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ detail: "Notification id must be an integer" });
  }

  const scope = regionScope(req.user, "region_id");
  try {
    // Existence check first: inserting straight into notification_reads would
    // hit a foreign-key error for an unknown id, which reads as a 503 rather
    // than the 404 it actually is. Costs a second round trip.
    const row = await first<{ id: number; title: string; message: string; created_at: string }>(
      `SELECT id, title, message, created_at
         FROM notifications
        WHERE id = ? ${scope.clause}`,
      [id, ...scope.params]
    );
    if (!row) {
      return res.status(404).json({ detail: "Notification not found" });
    }

    // OR IGNORE: marking an already-read notification read again is a no-op,
    // not an error - the UI fires this optimistically on every click.
    await run(
      `INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)`,
      [id, req.user!.id]
    );

    res.json({
      id: row.id,
      title: row.title,
      message: row.message,
      createdAt: toIso(row.created_at),
      read: true,
    });
  } catch (cause) {
    console.error("[notifications] mark read failed:", cause);
    res.status(503).json({ detail: "Could not update notification" });
  }
});
