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
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "../auth/passwords.js";
import { requireAuth, revokeSession } from "../middleware/auth.js";
import { isConfigured as emailConfigured, sendVerificationEmail } from "../services/email.js";

export const authRouter = Router();

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_TTL_MS = 30 * 60 * 1000;

/** Cheap sanity check - real deliverability isn't ours to verify, matching admin.ts. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

// ------------------------------------------------------------ email + password --

/**
 * A second way in, alongside Google - not a replacement for it. Still
 * invite-only: an admin has to create the `users` row first (POST
 * /api/admin/users), exactly as Google sign-in requires. This just gives an
 * already-invited person another way to prove who they are.
 *
 * Step 1. Mint a single-use verification token for an invited/active email
 * and hand back a link containing it. No email provider is wired up yet -
 * that is a deliberate stub, not a bug: the link is always logged
 * server-side, and echoed in the JSON response outside production so local
 * dev works without a real mailer. In production the response is generic
 * either way, so this also does not confirm which emails are onboarded.
 */
authRouter.post("/password/request", async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !looksLikeEmail(email.trim())) {
    return res.status(400).json({ detail: "A valid email is required" });
  }
  const normalisedEmail = email.trim();
  const generic = { detail: "If that email is eligible, a verification link has been sent." };

  try {
    const user = await first<{ id: string; status: string }>(
      `SELECT id, status FROM users WHERE email = ?`,
      [normalisedEmail]
    );
    if (!user || user.status === "suspended") {
      return res.json(generic);
    }

    const token = generateSessionToken();
    const tokenHash = await hashToken(token);

    await batch([
      {
        sql: `INSERT INTO email_verifications (id, user_id, expires_at) VALUES (?, ?, ?)`,
        params: [tokenHash, user.id, sqlTimestamp(new Date(Date.now() + VERIFICATION_TTL_MS))],
      },
      // Opportunistic sweep, same convention as oauth_states above.
      { sql: `DELETE FROM email_verifications WHERE expires_at < ?`, params: [sqlTimestamp()] },
    ]);

    const link = new URL("/auth/verify-email", frontendUrl());
    link.searchParams.set("token", token);
    console.log(`[auth] verification link for ${normalisedEmail}: ${link.toString()}`);

    // Awaited, not fire-and-forget: a serverless invocation can be torn down
    // the instant the response is sent, same reasoning as the ERP write in
    // commandCenter.ts. Failure is logged but never surfaced to the caller -
    // the generic response below must not reveal whether the send worked.
    if (emailConfigured()) {
      const sent = await sendVerificationEmail(normalisedEmail, link.toString());
      if (!sent) console.error(`[auth] email send failed for ${normalisedEmail}, link is above`);
    }

    const payload: { detail: string; devVerificationUrl?: string } = { ...generic };
    if (process.env.NODE_ENV !== "production") {
      payload.devVerificationUrl = link.toString();
    }
    res.json(payload);
  } catch (cause) {
    console.error("[auth] password verification request failed:", cause);
    res.status(503).json({ detail: "Could not process that request" });
  }
});

/**
 * Step 2. The link from step 1 lands here with the raw token. Setting a
 * password consumes it, proves the invitee controls that mailbox, and
 * activates the account - the same "first successful sign-in activates the
 * invite" convention the Google callback uses above.
 */
authRouter.post("/password/complete", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ detail: "A verification token is required" });
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const tokenHash = await hashToken(token);
    const row = await first<{ user_id: string; expires_at: string; consumed_at: string | null }>(
      `SELECT user_id, expires_at, consumed_at FROM email_verifications WHERE id = ?`,
      [tokenHash]
    );
    if (!row || row.consumed_at || row.expires_at <= sqlTimestamp()) {
      return res.status(400).json({ detail: "That verification link is invalid or has expired" });
    }

    const user = await first<{ status: string }>(`SELECT status FROM users WHERE id = ?`, [
      row.user_id,
    ]);
    if (!user || user.status === "suspended") {
      return res.status(400).json({ detail: "That account is not eligible" });
    }

    const passwordHash = await hashPassword(password);
    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const now = sqlTimestamp();

    await batch([
      { sql: `UPDATE email_verifications SET consumed_at = ? WHERE id = ?`, params: [now, tokenHash] },
      {
        sql: `UPDATE users
                 SET password_hash = ?, email_verified_at = ?, status = 'active', last_login_at = ?
               WHERE id = ?`,
        params: [passwordHash, now, now, row.user_id],
      },
      {
        sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
        params: [sessionTokenHash, row.user_id, sqlTimestamp(new Date(Date.now() + SESSION_TTL_MS))],
      },
      {
        sql: `INSERT INTO activity_log (user_id, action, kind) VALUES (?, ?, 'info')`,
        params: [row.user_id, "Verified email and set a password"],
      },
    ]);

    const freshUser = await first<{
      id: string; email: string; name: string; role: string; google_sub: string | null;
    }>(`SELECT id, email, name, role, google_sub FROM users WHERE id = ?`, [row.user_id]);
    res.json({
      token: sessionToken,
      user: freshUser && {
        id: freshUser.id,
        email: freshUser.email,
        name: freshUser.name,
        role: freshUser.role,
        hasPassword: true,
        hasGoogle: freshUser.google_sub !== null,
      },
    });
  } catch (cause) {
    console.error("[auth] password setup failed:", cause);
    res.status(503).json({ detail: "Could not complete verification" });
  }
});

/** Ordinary email + password sign-in, for an account that has already completed step 2 above. */
authRouter.post("/password/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  // One message for "no such account", "no password set yet" and "wrong
  // password" - narrowing that down is exactly what an attacker wants.
  const invalid = () => res.status(401).json({ detail: "Invalid email or password" });

  try {
    const user = await first<{
      id: string;
      status: string;
      password_hash: string | null;
      email_verified_at: string | null;
    }>(
      `SELECT id, status, password_hash, email_verified_at FROM users WHERE email = ?`,
      [email.trim()]
    );

    if (!user || !user.password_hash || !user.email_verified_at) return invalid();
    if (user.status !== "active") return invalid();

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return invalid();

    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const now = sqlTimestamp();

    await batch([
      { sql: `UPDATE users SET last_login_at = ? WHERE id = ?`, params: [now, user.id] },
      {
        sql: `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
        params: [sessionTokenHash, user.id, sqlTimestamp(new Date(Date.now() + SESSION_TTL_MS))],
      },
      {
        sql: `INSERT INTO activity_log (user_id, action, kind) VALUES (?, ?, 'info')`,
        params: [user.id, "Signed in with email and password"],
      },
    ]);

    const freshUser = await first<{
      id: string; email: string; name: string; role: string; google_sub: string | null;
    }>(`SELECT id, email, name, role, google_sub FROM users WHERE id = ?`, [user.id]);
    res.json({
      token: sessionToken,
      user: freshUser && {
        id: freshUser.id,
        email: freshUser.email,
        name: freshUser.name,
        role: freshUser.role,
        hasPassword: true,
        hasGoogle: freshUser.google_sub !== null,
      },
    });
  } catch (cause) {
    console.error("[auth] password login failed:", cause);
    res.status(503).json({ detail: "Could not sign in" });
  }
});

/**
 * Changes (or sets, for the first time) the password on the *currently
 * authenticated* account - distinct from the request/complete pair above,
 * which is for someone who cannot sign in yet. A Google-only account has no
 * `currentPassword` to check, so this doubles as "add a password sign-in
 * option" for them; an account that already has one must prove it first.
 */
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ detail: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const row = await first<{ password_hash: string | null }>(
      `SELECT password_hash FROM users WHERE id = ?`,
      [req.user!.id]
    );
    if (!row) return res.status(404).json({ detail: "Account not found" });

    if (row.password_hash) {
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({ detail: "Current password is required" });
      }
      const valid = await verifyPassword(currentPassword, row.password_hash);
      if (!valid) return res.status(401).json({ detail: "Current password is incorrect" });
    }

    const passwordHash = await hashPassword(newPassword);
    const now = sqlTimestamp();
    await batch([
      {
        sql: `UPDATE users
                 SET password_hash = ?,
                     email_verified_at = COALESCE(email_verified_at, ?)
               WHERE id = ?`,
        params: [passwordHash, now, req.user!.id],
      },
      {
        sql: `INSERT INTO activity_log (user_id, action, kind) VALUES (?, ?, 'info')`,
        params: [req.user!.id, row.password_hash ? "Changed password" : "Set a password"],
      },
    ]);

    res.json({ success: true });
  } catch (cause) {
    console.error("[auth] change-password failed:", cause);
    res.status(503).json({ detail: "Could not update the password" });
  }
});
