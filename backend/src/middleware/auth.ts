import type { NextFunction, Request, Response } from "express";
import { first, run } from "../db/d1.js";
import { hashToken, sqlTimestamp } from "../auth/tokens.js";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  regionId: string | null;
  /** Whether this account can sign in with a password, independent of Google. */
  hasPassword: boolean;
  /** Whether a Google account is linked (true after first Google sign-in). */
  hasGoogle: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionTokenHash?: string;
    }
  }
}

interface SessionRow {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  region_id: string | null;
  password_hash: string | null;
  google_sub: string | null;
}

function bearerFrom(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves a bearer token to a live session.
 *
 * This replaces the previous `mock.` + base64(user) token, which carried the
 * user record in the token body with no signature - anyone could mint an admin
 * token offline. Tokens are now opaque random values; the database holds only
 * their SHA-256 hash, and this lookup is what makes them revocable.
 *
 * Cost note: on the REST-API transport this is one HTTPS round trip per
 * authenticated request, on top of whatever the route itself queries.
 */
export async function resolveSession(
  authHeader: string | undefined
): Promise<{ user: SessionUser; tokenHash: string } | null> {
  const token = bearerFrom(authHeader);
  if (!token) return null;

  const tokenHash = await hashToken(token);

  const row = await first<SessionRow>(
    `SELECT s.id, s.user_id, u.email, u.name, u.role, u.status, u.avatar_url, u.region_id,
            u.password_hash, u.google_sub
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?`,
    [tokenHash, sqlTimestamp()]
  );

  if (!row) return null;

  // A suspended account keeps its session rows but must stop being honoured.
  if (row.status !== "active") return null;

  return {
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      avatarUrl: row.avatar_url,
      regionId: row.region_id,
      hasPassword: row.password_hash !== null,
      hasGoogle: row.google_sub !== null,
    },
    tokenHash,
  };
}

/** Gate for every route that serves account data. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resolved = await resolveSession(req.headers.authorization);
    if (!resolved) {
      res.status(401).json({ detail: "Invalid or missing token" });
      return;
    }
    req.user = resolved.user;
    req.sessionTokenHash = resolved.tokenHash;
    next();
  } catch (cause) {
    // A D1 outage must not read as "authenticated".
    console.error("[auth] session lookup failed:", cause);
    res.status(503).json({ detail: "Authentication is temporarily unavailable" });
  }
}

/**
 * Role gate. Layered on top of requireAuth, never instead of it.
 *
 * Note this checks a role, not a data scope. D1 has no row-level security, so
 * region/store scoping has to be enforced in the query layer - see the D1
 * decision note in brain.md.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ detail: "Invalid or missing token" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ detail: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/** Revokes a single session (logout). */
export async function revokeSession(tokenHash: string): Promise<void> {
  await run(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, [
    sqlTimestamp(),
    tokenHash,
  ]);
}
