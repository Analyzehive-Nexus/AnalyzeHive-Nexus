-- ===========================================================================
-- AnalyzeHive Nexus - initial schema
--
-- Target: Cloudflare D1 (SQLite). See the PORTING NOTES at the foot of this
-- file for the deltas if this moves to Postgres/Supabase instead.
--
-- Two conventions applied throughout, both deliberate:
--
--   1. Scoping columns (region_id) exist from day one even though nothing
--      filters on them yet. Roles beyond 'admin' are deferred by decision,
--      but retrofitting scoping into a shipped schema is the expensive part -
--      adding a role string later is not.
--
--   2. Timestamps are stored, never display strings. The prototype stores
--      "2m ago" and "10 Jan - 13:42" as data; those are presentation and are
--      computed in the UI from the ISO-8601 values here.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- scoping --

CREATE TABLE regions (
  id    TEXT PRIMARY KEY,                    -- 'north' | 'south' | 'east' | 'west'
  name  TEXT NOT NULL UNIQUE
) STRICT;

-- --------------------------------------------------------------- identity --

-- Sign-in is Google-only and invite-only. An admin creates the row first with
-- status='invited'; the person can then sign in with Google and the row flips
-- to 'active'. A Google account with no row here is refused - the allowlist IS
-- this table, so there is no self-service signup path to close off separately.
CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  email          TEXT COLLATE NOCASE NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  -- Additive by design: new roles are new strings, not a migration.
  role           TEXT NOT NULL DEFAULT 'admin'
                   CHECK (role IN ('admin', 'manager', 'employee')),

  -- Google's `sub` claim: the stable account identifier. Email can change on a
  -- Google account, `sub` cannot, so this is what we match on once known.
  -- NULL until the invited person completes their first sign-in.
  google_sub     TEXT UNIQUE,
  avatar_url     TEXT,

  status         TEXT NOT NULL DEFAULT 'invited'
                   CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by     TEXT REFERENCES users(id),
  invited_at     TEXT NOT NULL DEFAULT (datetime('now')),

  region_id      TEXT REFERENCES regions(id),
  store_id       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at  TEXT
) STRICT;
CREATE INDEX idx_users_status ON users(status);

-- Guards the OAuth redirect round trip. The `state` value is generated before
-- redirecting to Google and must come back unchanged, which is what stops an
-- attacker from replaying someone else's callback. Rows are single-use and
-- short-lived; sweep expired ones on write.
CREATE TABLE oauth_states (
  state        TEXT PRIMARY KEY,
  redirect_to  TEXT,                         -- validated the same way as callbackUrl
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT
) STRICT;
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);

-- No password_hash column: sign-in is Google-only, so there are no local
-- credentials to store, and /api/auth/change-password + /forgot-password
-- become dead endpoints (see the note in brain.md).
--
-- Replaces the unsigned base64 token in backend/src/middleware/auth.ts. That
-- token had to be stateless because serverless instances share no memory; a
-- real table removes that constraint and makes logout revocable.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,              -- opaque random id, NOT the user record
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
) STRICT;
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE activity_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('success', 'info', 'warning', 'error')),
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_activity_user_time ON activity_log(user_id, occurred_at DESC);

-- ---------------------------------------------------------- catalogue/stock --

CREATE TABLE skus (
  sku   TEXT PRIMARY KEY,                    -- 'SKU-9988'
  name  TEXT NOT NULL                        -- 'Insulin Glargine 100U/ml'
) STRICT;

CREATE TABLE inventory_batches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_code   TEXT UNIQUE,                  -- 'P-001245'
  sku          TEXT NOT NULL REFERENCES skus(sku),
  region_id    TEXT REFERENCES regions(id),
  quantity     INTEGER NOT NULL DEFAULT 0,
  -- Money as integer minor units (paise). Never REAL, never a formatted
  -- string - the prototype stores '₹52,000', which cannot be summed.
  value_minor  INTEGER NOT NULL DEFAULT 0,
  -- 'risk: 120 days' in the prototype is derived, not stored: it is
  -- julianday(expiry_date) - julianday('now').
  expiry_date  TEXT NOT NULL,                -- 'YYYY-MM-DD'
  status       TEXT NOT NULL CHECK (status IN ('Good', 'Warning', 'Critical')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX idx_batches_region ON inventory_batches(region_id, status);

-- --------------------------------------------------------------- alerting --

CREATE TABLE alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  level        TEXT NOT NULL CHECK (level IN ('critical', 'warning', 'info')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  detail       TEXT,
  batch_id     INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
  region_id    TEXT REFERENCES regions(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
) STRICT;
CREATE INDEX idx_alerts_open ON alerts(resolved_at, created_at DESC);

CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  region_id   TEXT REFERENCES regions(id),   -- NULL = broadcast to everyone
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- `read` is per-user, not a property of the notification. The prototype keeps
-- one global boolean on the notification itself, which silently breaks the
-- moment a second account exists - both users share one read state.
CREATE TABLE notification_reads (
  notification_id  INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (notification_id, user_id)
) STRICT;

-- ----------------------------------------------------------- market radar --

CREATE TABLE market_signals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,                -- 'PubMed', 'Twitter/X', ...
  title        TEXT NOT NULL,
  sentiment    TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'critical')),
  impact       TEXT NOT NULL CHECK (impact IN ('Low', 'Medium', 'High', 'Critical')),
  region_id    TEXT REFERENCES regions(id),
  detected_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_signals_detected ON market_signals(detected_at DESC);

CREATE TABLE network_nodes (
  id      TEXT PRIMARY KEY,                  -- 'A'..'D' today
  name    TEXT NOT NULL,
  kind    TEXT NOT NULL
            CHECK (kind IN ('internal', 'competitor', 'market', 'supplier')),
  status  TEXT NOT NULL
) STRICT;

-- Versioned rather than one row per node: keeping history means a regenerated
-- analysis does not destroy the previous one.
CREATE TABLE node_analyses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id         TEXT NOT NULL REFERENCES network_nodes(id) ON DELETE CASCADE,
  summary         TEXT NOT NULL,
  recommendation  TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_node_analyses ON node_analyses(node_id, generated_at DESC);

CREATE TABLE node_analysis_activity (
  analysis_id  INTEGER NOT NULL REFERENCES node_analyses(id) ON DELETE CASCADE,
  ordinal      INTEGER NOT NULL,
  activity     TEXT NOT NULL,
  PRIMARY KEY (analysis_id, ordinal)
) STRICT;

-- ------------------------------------------------------- commercial truth --

CREATE TABLE field_reps (
  id          TEXT PRIMARY KEY,              -- 'RP', 'SK', ...
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,                 -- 'Area Manager', 'Zone Manager'
  initials    TEXT NOT NULL,
  color       TEXT,                          -- presentation hint, e.g. 'bg-emerald-500'
  team_size   INTEGER NOT NULL DEFAULT 0,
  region_id   TEXT REFERENCES regions(id),
  -- The page is called a hierarchy audit but the prototype data is flat.
  -- This self-reference is what makes it an actual tree.
  manager_id  TEXT REFERENCES field_reps(id),
  user_id     TEXT REFERENCES users(id)      -- link to a login, when one exists
) STRICT;
CREATE INDEX idx_reps_manager ON field_reps(manager_id);
CREATE INDEX idx_reps_region  ON field_reps(region_id);

CREATE TABLE rep_metrics (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  rep_id    TEXT NOT NULL REFERENCES field_reps(id) ON DELETE CASCADE,
  period    TEXT NOT NULL,                   -- 'YYYY-MM'
  reported  INTEGER NOT NULL,
  verified  INTEGER NOT NULL,
  status    TEXT NOT NULL CHECK (status IN ('Verified', 'Flagged', 'Pending')),
  UNIQUE (rep_id, period)
) STRICT;

CREATE TABLE audit_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rep_id       TEXT NOT NULL REFERENCES field_reps(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  flagged      INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),
  occurred_at  TEXT NOT NULL
) STRICT;
CREATE INDEX idx_audit_rep_time ON audit_events(rep_id, occurred_at DESC);

-- ------------------------------------------------------- supply chain ops --

CREATE TABLE redistribution_plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  summary     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'approved', 'executed', 'cancelled')),
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE redistribution_steps (
  plan_id      INTEGER NOT NULL REFERENCES redistribution_plans(id) ON DELETE CASCADE,
  ordinal      INTEGER NOT NULL,
  instruction  TEXT NOT NULL,
  PRIMARY KEY (plan_id, ordinal)
) STRICT;

-- ------------------------------------------------------------ system status --

CREATE TABLE services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  region      TEXT,
  status      TEXT NOT NULL
                CHECK (status IN ('Operational', 'Degraded', 'Maintenance', 'Outage')),
  uptime_pct  REAL
) STRICT;

-- A time series. The prototype fakes latency with Math.random() on every
-- request; real probes append rows here and the UI reads the newest per service.
CREATE TABLE service_checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  latency_ms  INTEGER,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_checks_service_time ON service_checks(service_id, checked_at DESC);

CREATE TABLE incidents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('Info', 'Low', 'Medium', 'High')),
  status       TEXT NOT NULL
                 CHECK (status IN ('Investigating', 'Identified', 'Monitoring',
                                   'Resolved', 'Completed')),
  started_at   TEXT NOT NULL,
  resolved_at  TEXT
) STRICT;

-- ------------------------------------------------------------- ingestion ---
-- The only genuinely schema-flexible corner of the app: uploaded CSVs carry
-- arbitrary columns. This is the requirement that originally argued for
-- Postgres JSONB; the SQLite equivalent is below.

CREATE TABLE datasets (
  id            TEXT PRIMARY KEY,            -- the UUID /api/ingestion/upload returns
  uploaded_by   TEXT REFERENCES users(id),
  filename      TEXT,
  row_count     INTEGER NOT NULL DEFAULT 0,
  column_count  INTEGER NOT NULL DEFAULT 0,
  r2_key        TEXT,                        -- original CSV in R2, if retained
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- Preserves the original CSV header alongside the system field it was mapped
-- to, so a remap is possible after the fact without re-uploading.
CREATE TABLE dataset_columns (
  dataset_id     TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  ordinal        INTEGER NOT NULL,
  original_name  TEXT NOT NULL,
  mapped_key     TEXT NOT NULL,
  label          TEXT NOT NULL,
  PRIMARY KEY (dataset_id, ordinal)
) STRICT;

CREATE TABLE dataset_rows (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id  TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_index   INTEGER NOT NULL,
  -- SQLite has no JSONB type. TEXT + json_valid() is the equivalent, and
  -- json_extract() queries it. See PORTING NOTES for the Postgres form.
  data        TEXT NOT NULL CHECK (json_valid(data)),
  UNIQUE (dataset_id, row_index)
) STRICT;
CREATE INDEX idx_dataset_rows ON dataset_rows(dataset_id, row_index);

-- When one mapped field needs filtering at scale, index that JSON path via a
-- generated column. This is SQLite's answer to a Postgres GIN index on JSONB;
-- add it per-field on demand rather than up front:
--
--   ALTER TABLE dataset_rows ADD COLUMN sku TEXT
--     GENERATED ALWAYS AS (json_extract(data, '$.sku')) VIRTUAL;
--   CREATE INDEX idx_dataset_rows_sku ON dataset_rows(sku);

-- ===========================================================================
-- PORTING NOTES - if this moves to Postgres/Supabase
--
--   STRICT                    -> drop (Postgres is typed already)
--   TEXT PRIMARY KEY ids      -> UUID
--   INTEGER PRIMARY KEY AUTO. -> GENERATED ALWAYS AS IDENTITY
--   TEXT timestamps           -> TIMESTAMPTZ, DEFAULT now()
--   INTEGER 0/1 booleans      -> BOOLEAN
--   CHECK (x IN (...))        -> keep, or promote to native ENUM types
--   COLLATE NOCASE            -> CITEXT, or a lower(email) unique index
--   data TEXT CHECK(json_valid) -> data JSONB, plus:
--                                  CREATE INDEX ... USING GIN (data jsonb_path_ops)
--   Row Level Security        -> the region_id/store_id columns above are the
--                                intended RLS predicate; D1 has no RLS, so on
--                                D1 that scoping must be enforced in the query
--                                layer instead.
-- ===========================================================================
