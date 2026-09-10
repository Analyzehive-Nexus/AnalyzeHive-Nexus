-- ===========================================================================
-- Email + password sign-in, alongside Google - not replacing it.
--
-- Stays invite-only: an admin still creates the `users` row first via
-- POST /api/admin/users, exactly as the Google flow requires. This migration
-- only adds a second way for an already-invited person to prove who they are
-- and activate their account - it does not open a signup path.
--
-- `password_hash` and `email_verified_at` are both nullable: a Google-only
-- account never gets either, and the two sign-in methods coexist on one row.
-- ===========================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Mirrors `sessions`: the raw token is single-use and lives only in the link
-- sent to the invitee, the table stores only its SHA-256 hash, so a leaked
-- table cannot be replayed to claim someone else's invite.
CREATE TABLE email_verifications (
  id          TEXT PRIMARY KEY,              -- SHA-256 hash of the raw token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
) STRICT;
CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
