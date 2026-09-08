import type { Request } from "express";

/**
 * Bounded page size for list endpoints.
 *
 * Every list route needs one. With a realistically sized dataset an unbounded
 * SELECT is not merely slow: `/api/commercial-truth/visits` ran a correlated
 * subquery per row over 50k sales rows and timed out, and the watchlist
 * returned a 3.8MB payload. The cap is the contract - callers may ask for
 * less, never for more.
 */
export function pageLimit(req: Request, fallback = 100, max = 500): number {
  const raw = Number(req.query.limit);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}
