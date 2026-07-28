import { randomUUID } from "node:crypto";
import { Router } from "express";

export const ingestionRouter = Router();

ingestionRouter.post("/upload", (req, res) => {
  const { columns, rows } = req.body ?? {};

  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(400).json({ detail: "columns and rows arrays are required" });
  }

  res.json({
    id: randomUUID(),
    receivedRows: rows.length,
    receivedColumns: columns.length,
    receivedAt: new Date().toISOString(),
  });
});
