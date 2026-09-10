/**
 * Local stand-in for Cloudflare D1's REST API, backed by a real sqlite file.
 *
 * `src/db/d1.ts` speaks D1's exact HTTP envelope to
 * `${CLOUDFLARE_D1_API_BASE}/accounts/:id/d1/database/:id/query`. This
 * server implements that same envelope against a local file via
 * better-sqlite3, so local dev needs no Cloudflare account, token or network
 * round trip. Point at it by setting CLOUDFLARE_D1_API_BASE=http://localhost:8788
 * in .env - the three CLOUDFLARE_* credential vars still have to be
 * non-empty (d1.ts requires them truthy) but their values are never read
 * here, so any placeholder string works.
 *
 * On first run it applies every migration in `migrations/`, in filename
 * order, to a fresh file at the repo root's `database/local.db`. Delete
 * that file to reset.
 */
import express from "express";
import Database from "better-sqlite3";
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname is backend/scripts - the database folder lives at the repo root,
// two levels up, not inside backend/.
const dataDir = path.join(__dirname, "..", "..", "database");
const dbPath = path.join(dataDir, "local.db");
const migrationsDir = path.join(__dirname, "..", "migrations");

mkdirSync(dataDir, { recursive: true });
const isFresh = !existsSync(dbPath);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (isFresh) {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    console.log(`[local-d1] applied ${file}`);
  }
  console.log(`[local-d1] fresh database ready at ${dbPath}`);
} else {
  console.log(`[local-d1] using existing database at ${dbPath}`);
}

interface Statement {
  sql: string;
  params?: unknown[];
}

function runStatement(sql: string, params: unknown[] = []) {
  const isRead = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(sql);
  const stmt = db.prepare(sql);
  if (isRead) {
    return { results: stmt.all(...params), success: true, meta: {} };
  }
  const info = stmt.run(...params);
  return {
    results: [],
    success: true,
    meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
  };
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Mirrors the path shape d1.ts builds; the account/database ids in the URL
// are accepted but ignored since there is only ever one local database.
app.post("/accounts/:accountId/d1/database/:databaseId/query", (req, res) => {
  const body = (req.body ?? {}) as { sql?: string; params?: unknown[]; batch?: Statement[] };
  const statements: Statement[] = body.batch ?? [{ sql: body.sql ?? "", params: body.params ?? [] }];

  try {
    const result = statements.map((s) => runStatement(s.sql, s.params ?? []));
    res.json({ result, success: true, errors: [], messages: [] });
  } catch (err) {
    res.status(200).json({
      result: [],
      success: false,
      errors: [{ code: 0, message: err instanceof Error ? err.message : String(err) }],
      messages: [],
    });
  }
});

const port = Number(process.env.LOCAL_D1_PORT ?? 8788);
app.listen(port, () => {
  console.log(`[local-d1] listening on http://localhost:${port}`);
});
