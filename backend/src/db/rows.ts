/**
 * Row-shaping helpers shared by the data routes.
 *
 * The schema stores timestamps, never display strings ("2m ago", "10 Jan -
 * 13:42" are presentation and belong in the UI). SQLite's datetime('now')
 * writes 'YYYY-MM-DD HH:MM:SS' in UTC with no zone marker, which `new Date()`
 * parses as *local* time in every browser - an hour-to-day-sized error
 * depending on the viewer. toIso() is what stops that.
 */

/** 'YYYY-MM-DD HH:MM:SS' (UTC, as D1 stores it) -> 'YYYY-MM-DDTHH:MM:SSZ'. */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  // Already ISO (anything we wrote via toISOString) - leave it alone.
  if (value.includes("T")) return value.endsWith("Z") ? value : `${value}Z`;
  return `${value.replace(" ", "T")}Z`;
}

/** SQLite has no boolean type; the schema stores 0/1 INTEGERs. */
export function toBool(value: number | null | undefined): boolean {
  return value === 1;
}

/**
 * Escapes a user-supplied LIKE pattern.
 *
 * Without this, a search for "50%" matches every row: % and _ are wildcards
 * inside LIKE, so the query means "50 followed by anything". Callers must pair
 * this with ESCAPE '\' in the SQL.
 */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
