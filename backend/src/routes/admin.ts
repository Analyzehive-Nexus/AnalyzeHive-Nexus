import { Router } from "express";
import { first, query, run } from "../db/d1.js";
import { randomId, sqlTimestamp } from "../auth/tokens.js";
import { requireRole } from "../middleware/auth.js";

export const adminRouter = Router();

// Every route here is admin-only. requireAuth is applied upstream in app.ts.
adminRouter.use(requireRole("admin"));

const ROLES = ["admin", "manager", "employee"] as const;
const STATUSES = ["invited", "active", "suspended"] as const;

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  region_id: string | null;
  avatar_url: string | null;
  invited_by: string | null;
  invited_at: string;
  last_login_at: string | null;
}

/** Cheap sanity check - real deliverability is Google's problem, not ours. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ------------------------------------------------------------------ list --

adminRouter.get("/users", async (_req, res) => {
  try {
    const users = await query<UserRow>(
      `SELECT id, email, name, role, status, region_id, avatar_url,
              invited_by, invited_at, last_login_at
         FROM users
        ORDER BY CASE status WHEN 'invited' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
                 invited_at DESC`
    );
    res.json({ users });
  } catch (cause) {
    console.error("[admin] list users failed:", cause);
    res.status(503).json({ detail: "Could not load users" });
  }
});

// ---------------------------------------------------------------- invite --

/**
 * Onboards someone. This is the ONLY way an account comes into existence -
 * the Google callback never creates users, it only matches existing ones.
 *
 * No email is sent: the invitee just signs in with Google at the normal login
 * page and is recognised. Nothing here needs to be secret, so there is no
 * invite token to leak or expire.
 */
adminRouter.post("/users", async (req, res) => {
  const { email, name, role, regionId } = req.body ?? {};

  if (typeof email !== "string" || !looksLikeEmail(email.trim())) {
    return res.status(400).json({ detail: "A valid email is required" });
  }
  const requestedRole = typeof role === "string" ? role : "employee";
  if (!ROLES.includes(requestedRole as (typeof ROLES)[number])) {
    return res.status(400).json({ detail: `role must be one of: ${ROLES.join(", ")}` });
  }

  const normalisedEmail = email.trim();
  // Placeholder until their first sign-in, when Google supplies the real name.
  const displayName =
    typeof name === "string" && name.trim() ? name.trim() : normalisedEmail.split("@")[0];

  try {
    const existing = await first<{ id: string; status: string }>(
      `SELECT id, status FROM users WHERE email = ?`,
      [normalisedEmail]
    );
    if (existing) {
      return res.status(409).json({
        detail: `${normalisedEmail} is already onboarded (status: ${existing.status})`,
      });
    }

    const id = randomId(16);
    await run(
      `INSERT INTO users (id, email, name, role, status, region_id, invited_by, invited_at)
       VALUES (?, ?, ?, ?, 'invited', ?, ?, ?)`,
      [
        id,
        normalisedEmail,
        displayName,
        requestedRole,
        typeof regionId === "string" && regionId ? regionId : null,
        req.user?.id ?? null,
        sqlTimestamp(),
      ]
    );

    res.status(201).json({
      id,
      email: normalisedEmail,
      name: displayName,
      role: requestedRole,
      status: "invited",
    });
  } catch (cause) {
    console.error("[admin] invite failed:", cause);
    res.status(503).json({ detail: "Could not onboard that user" });
  }
});

// ---------------------------------------------------------------- update --

adminRouter.patch("/users/:id", async (req, res) => {
  const { role, status, regionId } = req.body ?? {};
  const targetId = req.params.id;

  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).json({ detail: `role must be one of: ${ROLES.join(", ")}` });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ detail: `status must be one of: ${STATUSES.join(", ")}` });
  }

  // Locking yourself out is not a recoverable mistake here - there is no
  // password reset and no second way in.
  if (targetId === req.user?.id && (status === "suspended" || (role && role !== "admin"))) {
    return res.status(400).json({ detail: "You cannot suspend or demote your own account" });
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (role !== undefined) [updates.push("role = ?"), params.push(role)];
  if (status !== undefined) [updates.push("status = ?"), params.push(status)];
  if (regionId !== undefined) [updates.push("region_id = ?"), params.push(regionId || null)];

  if (updates.length === 0) {
    return res.status(400).json({ detail: "Nothing to update" });
  }
  params.push(targetId);

  try {
    const meta = await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    if (!meta.changes) return res.status(404).json({ detail: "User not found" });

    // Suspension must take effect now, not whenever the session expires.
    if (status === "suspended") {
      await run(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [
        sqlTimestamp(),
        targetId,
      ]);
    }

    const updated = await first<UserRow>(
      `SELECT id, email, name, role, status, region_id, avatar_url,
              invited_by, invited_at, last_login_at
         FROM users WHERE id = ?`,
      [targetId]
    );
    res.json(updated);
  } catch (cause) {
    console.error("[admin] update failed:", cause);
    res.status(503).json({ detail: "Could not update that user" });
  }
});

// ---------------------------------------------------------------- revoke --

/**
 * Removes an invite that was never used. Accounts that have signed in are
 * suspended instead of deleted, so their activity_log and audit trail survive.
 */
adminRouter.delete("/users/:id", async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user?.id) {
    return res.status(400).json({ detail: "You cannot remove your own account" });
  }

  try {
    const target = await first<{ status: string }>(`SELECT status FROM users WHERE id = ?`, [
      targetId,
    ]);
    if (!target) return res.status(404).json({ detail: "User not found" });

    if (target.status !== "invited") {
      return res.status(409).json({
        detail: "This account has signed in. Suspend it instead of deleting it.",
      });
    }

    await run(`DELETE FROM users WHERE id = ?`, [targetId]);
    res.json({ success: true });
  } catch (cause) {
    console.error("[admin] delete failed:", cause);
    res.status(503).json({ detail: "Could not remove that user" });
  }
});
