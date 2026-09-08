import { Router } from "express";
import { batchQuery, query } from "../db/d1.js";
import { toBool, toIso } from "../db/rows.js";
import { requireRole } from "../middleware/auth.js";

export const governanceRouter = Router();

/**
 * RBAC, digital-signature credentials and the 21 CFR Part 11 audit trail.
 *
 * The profile screen used to show a gamified "rank"; the regulated-industry
 * equivalents are a designation, an explicit permission set, a signature
 * credential and a sign-off history. All four are records, not decoration.
 */

interface ProfileRow {
  designation_title: string | null;
  department: string | null;
  grade: number | null;
  region_name: string | null;
}
interface PermRow { permission_id: string; description: string; requires_signature: number }
interface CredRow { id: string; issued_at: string; expires_at: string | null; status: string }
interface SignoffRow {
  id: number; record_type: string; record_id: string; meaning: string;
  signed_at: string; credential_id: string; payload_hash: string;
}
interface ScopeRow { scope_type: string; scope_id: string }

governanceRouter.get("/me", async (req, res) => {
  const userId = req.user?.id ?? "";
  const role = req.user?.role ?? "employee";
  try {
    const [profile, perms, creds, signoffs, scopes] = await batchQuery<
      [ProfileRow[], PermRow[], CredRow[], SignoffRow[], ScopeRow[]]
    >([
      {
        sql: `SELECT d.title AS designation_title, d.department, d.grade, r.name AS region_name
                FROM users u
                LEFT JOIN designations d ON d.id = u.designation_id
                LEFT JOIN regions r ON r.id = u.region_id
               WHERE u.id = ?`,
        params: [userId],
      },
      {
        sql: `SELECT rp.permission_id, p.description, p.requires_signature
                FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
               WHERE rp.role = ?
               ORDER BY rp.permission_id
               LIMIT 200`,
        params: [role],
      },
      {
        sql: `SELECT id, issued_at, expires_at, status
                FROM signature_credentials
               WHERE user_id = ?
               ORDER BY issued_at DESC
               LIMIT 20`,
        params: [userId],
      },
      {
        sql: `SELECT id, record_type, record_id, meaning, signed_at,
                     credential_id, payload_hash
                FROM part11_signoffs
               WHERE user_id = ?
               ORDER BY signed_at DESC
               LIMIT 20`,
        params: [userId],
      },
      { sql: `SELECT scope_type, scope_id FROM user_scopes WHERE user_id = ? LIMIT 200`, params: [userId] },
    ]);

    res.json({
      designation: profile[0]?.designation_title ?? null,
      department: profile[0]?.department ?? null,
      grade: profile[0]?.grade ?? null,
      homeRegion: profile[0]?.region_name ?? null,
      permissions: perms.map((p) => ({
        id: p.permission_id,
        description: p.description,
        requiresSignature: toBool(p.requires_signature),
      })),
      // The active credential is what a Part 11 signature is attributed to.
      credential: creds.find((c) => c.status === "active")
        ? {
            id: creds[0].id,
            issuedAt: toIso(creds[0].issued_at),
            expiresAt: toIso(creds[0].expires_at),
            status: creds[0].status,
          }
        : null,
      signoffs: signoffs.map((s) => ({
        id: s.id,
        recordType: s.record_type,
        recordId: s.record_id,
        meaning: s.meaning,
        signedAt: toIso(s.signed_at),
        credentialId: s.credential_id,
        payloadHash: s.payload_hash,
      })),
      scopes: scopes.map((s) => ({ type: s.scope_type, id: s.scope_id })),
    });
  } catch (cause) {
    console.error("[governance] profile failed:", cause);
    res.status(503).json({ detail: "Could not load governance profile" });
  }
});

interface TrailRow {
  id: number; action: string; entity_type: string; entity_id: string;
  field: string | null; old_value: string | null; new_value: string | null;
  reason: string | null; occurred_at: string; user_name: string | null;
}

/**
 * The audit trail is append-only by convention (D1 cannot REVOKE), so this is
 * read-only by design - there is deliberately no write endpoint here.
 * Restricted to roles holding audit.view.
 */
governanceRouter.get("/audit-trail", requireRole("admin", "manager"), async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const entity = typeof req.query.entityType === "string" ? req.query.entityType : null;
  try {
    const rows = await query<TrailRow>(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.field,
              a.old_value, a.new_value, a.reason, a.occurred_at, u.name AS user_name
         FROM audit_trail a
         LEFT JOIN users u ON u.id = a.user_id
        WHERE (? IS NULL OR a.entity_type = ?)
        ORDER BY a.occurred_at DESC, a.id DESC
        LIMIT ?`,
      [entity, entity, limit]
    );
    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        field: r.field,
        oldValue: r.old_value,
        newValue: r.new_value,
        reason: r.reason,
        occurredAt: toIso(r.occurred_at),
        actor: r.user_name,
      })),
    });
  } catch (cause) {
    console.error("[governance] audit trail failed:", cause);
    res.status(503).json({ detail: "Could not load audit trail" });
  }
});
