import { Router } from "express";
import { batch, first, run } from "../db/d1.js";
import {
  buildAuthUrl,
  exchangeCodeForIdentity,
  GoogleAuthError,
  isGoogleConfigured,
} from "../auth/google.js";
import {
  generateSessionToken,
  hashToken,
  randomId,
  SESSION_TTL_MS,
  sqlTimestamp,
} from "../auth/tokens.js";
import { requireAuth, revokeSession } from "../middleware/auth.js";

export const authRouter = Router();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3000";
}

/**
 * Only same-origin, path-absolute targets survive. Mirrors the frontend's
 * safeRedirect() - an open redirect is just as reachable through the OAuth
 * `state` round trip as through a query parameter.
 */
function safePath(target: string | null | undefined): string {
  if (!target || !target.startsWith("/")) return "/";
  if (target.startsWith("//") || target.startsWith("/\\")) return "/";
  try {
    const resolved = new URL(target, "http://localhost");
    if (resolved.origin !== "http://localhost") return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}

/** Sends the browser back to the frontend with an error it can render. */
function failTo(res: import("express").Response, reason: string): void {
  const url = new URL("/login", frontendUrl());
  url.searchParams.set("error", reason);
  res.redirect(url.toString());
}

// ---------------------------------------------------------------- sign-in --

/**
 * Step 1. Mint a one-time `state`, persist it, and bounce to Google.
 *
 * `state` is what ties the callback back to a request we actually started;
 * without it an attacker can feed a victim's browser their own callback URL.
 */
authRouter.get("/google", async (req, res) => {
  if (!isGoogleConfigured()) {
    return failTo(res, "oauth_not_configured");
  }

  try {
    const state = randomId(24);
    const redirectTo = safePath(
      typeof req.query.redirect === "string" ? req.query.redirect : "/"
    );

    await batch([
      {
        sql: `INSERT INTO oauth_states (state, redirect_to, expires_at) VALUES (?, ?, ?)`,
        params: [state, redirectTo, sqlTimestamp(new Date(Date.now() + OAUTH_STATE_TTL_MS))],
      },
      // Opportunistic sweep so the table cannot grow without bound.
      { sql: `DELETE FROM oauth_states WHERE expires_at < ?`, params: [sqlTimestamp()] },
    ]);

    res.redirect(buildAuthUrl(state));
  } catch (cause) {
    console.error("[auth] failed to start Google sign-in:", cause);
    failTo(res, "signin_unavailable");
  }
});

/**
 * Step 2. Google sends the browser back here.
 *
 * Identity from Google is necessary but NOT sufficient: the account must
 * already exist in `users`, put there by an admin. There is no branch in this
 * handler that creates a user, which is what makes sign-up impossible.
 */
authRouter.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (typeof error === "string") return failTo(res, "google_denied");
  if (typeof code !== "string" || typeof state !== "string") {
    return failTo(res, "invalid_callback");
  }

  try {
    // Single-use: consume the state row and refuse if it was already used.
    const stateRow = await first<{ redirect_to: string | null; expires_at: string; consumed_at: string | null }>(
      `SELECT redirect_to, expires_at, consumed_at FROM oauth_states WHERE state = ?`,
      [state]
    );

    if (!stateRow || stateRow.consumed_at || stateRow.expires_at <= sqlTimestamp()) {
      return failTo(res, "expired_state");
    }
    await run(`UPDATE oauth_states SET consumed_at = ? WHERE state = ?`, [sqlTimestamp(), state]);

    const identity = await exchangeCodeForIdentity(code);

    // The allowlist. Match on google_sub once known (an account's email can
    // change, its sub cannot), otherwise on the invited email address.
    const user = await first<{ id: string; status: string; google_sub: string | null }>(
      `SELECT id, status, google_sub FROM users
        WHERE google_sub = ? OR (google_sub IS NULL AND email = ?)
        LIMIT 1`,
      [identity.sub, identity.email]
    );

    if (!user) return failTo(res, "not_invited");
    if (user.status === "suspended") return failTo(res, "account_suspended");

    const token = generateSessionToken();
    const tokenHash = await hashToken(token);
    const now = sqlTimestamp();

    await batch([
      {
        // First sign-in binds the Google account and activates the invite.
        sql: `UPDATE users
                 SET google_sub = ?, name = ?, avatar_url = ?,
                     status = 'active', last_login_at = ?
               WHERE id = ?`,
        params: [identity.sub, identity.name, identity.picture ?? null, now, user.id],
      },
      {
        sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
        params: [tokenHash, user.id, sqlTimestamp(new Date(Date.now() + SESSION_TTL_MS))],
      },
      {
        sql: `INSERT INTO activity_log (user_id, action, kind) VALUES (?, ?, 'info')`,
        params: [user.id, "Signed in with Google"],
      },
    ]);

    // Hand the token over in the URL fragment, not the query string: fragments
    // are never sent to a server, so it stays out of access logs and Referer.
    const target = new URL("/auth/callback", frontendUrl());
    target.hash = new URLSearchParams({
      token,
      redirect: safePath(stateRow.redirect_to),
    }).toString();

    res.redirect(target.toString());
  } catch (cause) {
    if (cause instanceof GoogleAuthError) {
      console.warn("[auth] Google sign-in rejected:", cause.message);
      return failTo(res, "google_rejected");
    }
    console.error("[auth] callback failed:", cause);
    failTo(res, "signin_failed");
  }
});

// ----------------------------------------------------------------- session --

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  try {
    if (req.sessionTokenHash) await revokeSession(req.sessionTokenHash);
    res.json({ success: true });
  } catch (cause) {
    console.error("[auth] logout failed:", cause);
    res.status(500).json({ detail: "Could not end the session" });
  }
});

// Password endpoints are deliberately gone. Sign-in is Google-only, so there
// are no local credentials to change or reset - Google owns that flow. The
// frontend's "Change Password" and "Forgot Key?" UI was removed to match.
