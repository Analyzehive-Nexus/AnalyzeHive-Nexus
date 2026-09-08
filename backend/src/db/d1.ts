/**
 * Cloudflare D1 client over the HTTP REST API.
 *
 * D1's fast path is a Worker binding (`env.DB`), which only exists inside the
 * Workers runtime. This backend runs on Node, so every statement here is an
 * HTTPS round trip to Cloudflare - budget 50-200ms per call and avoid issuing
 * them in loops. `batch()` exists precisely to collapse N calls into one.
 *
 * When this service moves to Workers, this module is the only thing that has
 * to change: swap the fetch for `env.DB.prepare(...)` and keep the same
 * query/first/run/batch/batchQuery surface.
 */

// Overridable so the client can be pointed at a local D1 stub in tests, or
// through an egress proxy. Defaults to Cloudflare's real API.
const CF_API = process.env.CLOUDFLARE_D1_API_BASE ?? "https://api.cloudflare.com/client/v4";

export interface D1Meta {
  changes?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  duration?: number;
}

interface D1ResultEnvelope<T> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1Response<T> {
  result: D1ResultEnvelope<T>[];
  success: boolean;
  errors: { code: number; message: string }[];
  messages: unknown[];
}

export class D1Error extends Error {
  constructor(message: string, readonly sql?: string) {
    super(message);
    this.name = "D1Error";
  }
}

function config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new D1Error(
      "D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, " +
        "CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN (see .env.example)."
    );
  }
  return { accountId, databaseId, apiToken };
}

/** True when the three env vars are present - lets routes degrade instead of 500. */
export function isConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_D1_DATABASE_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  );
}

async function post<T>(
  path: string,
  body: unknown,
  sqlForError?: string
): Promise<D1ResultEnvelope<T>[]> {
  const { accountId, databaseId, apiToken } = config();
  const url = `${CF_API}/accounts/${accountId}/d1/database/${databaseId}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    throw new D1Error(
      `Could not reach D1: ${cause instanceof Error ? cause.message : String(cause)}`,
      sqlForError
    );
  }

  let payload: D1Response<T>;
  try {
    payload = (await response.json()) as D1Response<T>;
  } catch {
    throw new D1Error(`D1 returned a non-JSON response (HTTP ${response.status})`, sqlForError);
  }

  if (!response.ok || !payload.success) {
    // Cloudflare reports SQL errors in `errors`, not the HTTP status.
    const detail =
      payload.errors?.map((e) => `[${e.code}] ${e.message}`).join("; ") ||
      `HTTP ${response.status}`;
    throw new D1Error(`D1 query failed: ${detail}`, sqlForError);
  }

  return payload.result;
}

/** Runs one statement and returns every row. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await post<T>("/query", { sql, params }, sql);
  return result[0]?.results ?? [];
}

/** Runs one statement and returns the first row, or null. */
export async function first<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Runs one write and returns D1's metadata (changes, last_row_id). */
export async function run(sql: string, params: unknown[] = []): Promise<D1Meta> {
  const result = await post("/query", { sql, params }, sql);
  return result[0]?.meta ?? {};
}

/**
 * Runs several statements in one HTTP round trip.
 *
 * This is the main lever against REST-API latency: three statements sent
 * separately cost three round trips, batched they cost one. Note D1 does not
 * expose interactive transactions over REST - a batch is not a rollback unit.
 *
 * The wire format is {"batch": [...]}, NOT a bare array - Cloudflare rejects
 * an array body with "Expected object, received array". One result envelope
 * comes back per statement, in order.
 */
export async function batch(
  statements: { sql: string; params?: unknown[] }[]
): Promise<D1Meta[]> {
  if (statements.length === 0) return [];
  const result = await post(
    "/query",
    { batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) },
    statements.map((s) => s.sql).join("; ")
  );
  return result.map((r) => r.meta ?? {});
}

/**
 * Runs several *reads* in one HTTP round trip and returns each one's rows.
 *
 * `batch()` above returns only metadata, which is all a write needs. Two
 * independent SELECTs on the same page (rows + their total, list + its
 * filter options) would otherwise cost two round trips on this transport.
 * Results come back in the order the statements were given.
 */
export async function batchQuery<T extends unknown[]>(
  statements: { sql: string; params?: unknown[] }[]
): Promise<T> {
  if (statements.length === 0) return [] as unknown as T;
  const result = await post<Record<string, unknown>>(
    "/query",
    { batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) },
    statements.map((s) => s.sql).join("; ")
  );
  return result.map((r) => r.results ?? []) as unknown as T;
}
