import type { SessionUser } from "../middleware/auth.js";

/**
 * Region scoping for reads that carry a region_id.
 *
 * D1 has no row-level security. On Postgres this predicate would live in the
 * database and it would refuse to hand back another region's rows no matter
 * what the query said; here it is only ever as good as the query layer, so a
 * forgotten filter is a data leak with nothing behind it. Funnelling every
 * scopeable read through this one helper is the mitigation - it takes the
 * caller's scope as a required argument so it cannot be forgotten per-route.
 *
 * Today every account is an admin and this is a no-op. It stops being one the
 * day a manager/employee row exists, which is exactly when a per-route filter
 * would have been missed.
 */
export function regionScope(
  user: SessionUser | undefined,
  column: string
): { clause: string; params: string[] } {
  // `column` is always a literal from our own SQL, never request input.
  if (!user || user.role === "admin") return { clause: "", params: [] };

  // A scoped user with no region sees only unscoped (broadcast) rows. Failing
  // closed is deliberate: the alternative leaks every region to a null scope.
  if (!user.regionId) return { clause: `AND ${column} IS NULL`, params: [] };

  return { clause: `AND (${column} IS NULL OR ${column} = ?)`, params: [user.regionId] };
}
