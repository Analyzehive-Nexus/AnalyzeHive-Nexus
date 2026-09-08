import { randomUUID } from "node:crypto";
import { Router } from "express";
import { batch, run } from "../db/d1.js";

export const ingestionRouter = Router();

// An upload used to be acknowledged and dropped on the floor. Persisting it
// means these limits now matter: rows arrive as one JSON body (express caps it
// at 5mb) and each row becomes a bound statement, so a runaway CSV would sit
// in a loop of HTTPS round trips to D1.
const MAX_ROWS = 5_000;
// D1 allows at most 100 bound parameters per statement - a lower ceiling than
// SQLite's own 999, and it fails at execution time with "too many SQL
// variables", not at build time. Both chunk sizes are that budget divided by
// the columns each row binds.
const ROWS_PER_STATEMENT = 33; // x 3 params (dataset_id, row_index, data) = 99
const COLUMNS_PER_STATEMENT = 20; // x 5 params = 100
const STATEMENTS_PER_BATCH = 50;

interface ColumnInput {
  key: string;
  label: string;
  original?: string;
}

function validColumn(value: unknown): value is ColumnInput {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.key === "string" && c.key.length > 0 && typeof c.label === "string";
}

/**
 * Stores an uploaded CSV as a dataset plus its rows.
 *
 * Rows are JSON text (SQLite has no JSONB) with a json_valid CHECK on the
 * column, which is the schema-flexible corner the rest of the database
 * deliberately is not - an upload's columns are whatever the file had.
 */
ingestionRouter.post("/upload", async (req, res) => {
  const { columns, rows, filename } = req.body ?? {};

  if (!Array.isArray(columns) || !Array.isArray(rows)) {
    return res.status(400).json({ detail: "columns and rows arrays are required" });
  }
  if (!columns.every(validColumn)) {
    return res.status(400).json({ detail: "each column needs a non-empty key and a label" });
  }
  if (!rows.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))) {
    return res.status(400).json({ detail: "each row must be an object" });
  }
  if (rows.length > MAX_ROWS) {
    return res
      .status(413)
      .json({ detail: `Too many rows: ${rows.length} (limit ${MAX_ROWS} per upload)` });
  }

  const id = randomUUID();
  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `INSERT INTO datasets (id, uploaded_by, filename, row_count, column_count)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        id,
        req.user!.id,
        typeof filename === "string" ? filename.slice(0, 255) : null,
        rows.length,
        columns.length,
      ],
    },
  ];

  // original_name preserves the CSV's own header next to the field it was
  // mapped to, so a remap is possible later without re-uploading.
  for (let start = 0; start < columns.length; start += COLUMNS_PER_STATEMENT) {
    const chunk: ColumnInput[] = columns.slice(start, start + COLUMNS_PER_STATEMENT);
    statements.push({
      sql: `INSERT INTO dataset_columns (dataset_id, ordinal, original_name, mapped_key, label)
            VALUES ${chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")}`,
      params: chunk.flatMap((c, i) => [id, start + i, c.original ?? c.key, c.key, c.label]),
    });
  }

  for (let start = 0; start < rows.length; start += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(start, start + ROWS_PER_STATEMENT);
    statements.push({
      sql: `INSERT INTO dataset_rows (dataset_id, row_index, data)
            VALUES ${chunk.map(() => "(?, ?, ?)").join(", ")}`,
      params: chunk.flatMap((row: unknown, i: number) => [id, start + i, JSON.stringify(row)]),
    });
  }

  try {
    for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
      await batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
    }
  } catch (cause) {
    console.error("[ingestion] upload failed:", cause);
    // D1 has no interactive transactions over REST, so a batch is not a
    // rollback unit and a mid-upload failure leaves a partial dataset behind.
    // Deleting the parent cascades to its columns and rows; if this cleanup
    // also fails there is nothing further to try from here.
    try {
      await run(`DELETE FROM datasets WHERE id = ?`, [id]);
    } catch (cleanupCause) {
      console.error("[ingestion] partial dataset %s left behind:", id, cleanupCause);
    }
    return res.status(503).json({ detail: "Could not store the upload" });
  }

  res.json({
    id,
    receivedRows: rows.length,
    receivedColumns: columns.length,
    receivedAt: new Date().toISOString(),
  });
});
