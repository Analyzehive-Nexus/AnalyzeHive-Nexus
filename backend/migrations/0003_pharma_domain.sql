-- ===========================================================================
-- AnalyzeHive Nexus - pharmaceutical domain
--
-- Turns the generic operations prototype into a pharma supply-chain system.
-- Follows the two conventions from 0001 (region_id scoping everywhere it
-- could apply; timestamps stored, never display strings) and adds a third:
--
--   3. Money is stored as INTEGER minor units in a single canonical currency
--      (INR paise). Display currency is a per-user preference resolved through
--      fx_rates at read time. Never store a formatted amount, and never store
--      the same amount twice in two currencies.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- =========================================================== currency ======

-- Canonical currency is INR; every *_minor column in this file is paise.
CREATE TABLE currencies (
  code         TEXT PRIMARY KEY,             -- ISO 4217: 'INR', 'USD', 'EUR'
  symbol       TEXT NOT NULL,
  name         TEXT NOT NULL,
  -- Minor units per major unit (100 for paise/cents). Kept explicit rather
  -- than assumed, because zero-decimal currencies exist (JPY).
  minor_units  INTEGER NOT NULL DEFAULT 100 CHECK (minor_units > 0),
  locale       TEXT NOT NULL DEFAULT 'en-IN' -- Intl.NumberFormat locale
) STRICT;

-- Rate is "how many minor units of `code` per 1 INR paise", stored as REAL.
-- A real deployment refreshes these from an FX feed; the seed is indicative.
CREATE TABLE fx_rates (
  code          TEXT PRIMARY KEY REFERENCES currencies(code) ON DELETE CASCADE,
  rate_from_inr REAL NOT NULL CHECK (rate_from_inr > 0),
  as_of         TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- =========================================================== governance ====

-- Corporate designations, replacing the gamified "rank" the UI used to show.
CREATE TABLE designations (
  id            TEXT PRIMARY KEY,            -- 'head-global-supply'
  title         TEXT NOT NULL,               -- 'Head of Global Supply'
  department    TEXT NOT NULL,
  -- Seniority band, used for ordering and for approval thresholds.
  grade         INTEGER NOT NULL DEFAULT 1 CHECK (grade BETWEEN 1 AND 10)
) STRICT;

-- RBAC. Roles on `users` stay a plain string (0001's additive design); these
-- tables say what a role may actually DO, so a new permission is a row.
CREATE TABLE permissions (
  id           TEXT PRIMARY KEY,             -- 'supply.approve_transfer'
  description  TEXT NOT NULL,
  -- Part 11 §11.10(d): a signed action must name the permission it required.
  requires_signature INTEGER NOT NULL DEFAULT 0 CHECK (requires_signature IN (0, 1))
) STRICT;

CREATE TABLE role_permissions (
  role           TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  permission_id  TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
) STRICT;

-- 21 CFR Part 11 §11.100: each signer gets a credential unique to them, and it
-- is never reused or reassigned. Revocation is a status change, not a delete,
-- because signatures already applied must stay attributable.
CREATE TABLE signature_credentials (
  id            TEXT PRIMARY KEY,            -- printed on the sign-off record
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'expired', 'revoked')),
  revoked_at    TEXT,
  revoked_by    TEXT REFERENCES users(id)
) STRICT;
CREATE INDEX idx_sigcred_user ON signature_credentials(user_id, status);

-- 21 CFR Part 11 §11.50: a signature manifestation records the signer, the
-- moment, and the MEANING of the signature (approval, review, responsibility).
CREATE TABLE part11_signoffs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL REFERENCES users(id),
  credential_id  TEXT NOT NULL REFERENCES signature_credentials(id),
  record_type    TEXT NOT NULL,              -- 'redistribution_plan', 'batch_release'
  record_id      TEXT NOT NULL,
  meaning        TEXT NOT NULL
                   CHECK (meaning IN ('approved', 'reviewed', 'authored', 'responsibility')),
  signed_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- Hash over the signed payload, so a later mutation is detectable.
  payload_hash   TEXT NOT NULL
) STRICT;
CREATE INDEX idx_signoff_record ON part11_signoffs(record_type, record_id);
CREATE INDEX idx_signoff_user   ON part11_signoffs(user_id, signed_at DESC);

-- 21 CFR Part 11 §11.10(e): computer-generated, time-stamped, append-only.
-- Previous values are retained rather than overwritten. Nothing in the app
-- issues UPDATE or DELETE against this table.
CREATE TABLE audit_trail (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT REFERENCES users(id),
  action       TEXT NOT NULL,                -- 'update' | 'create' | 'delete' | 'sign'
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  field        TEXT,
  old_value    TEXT,
  new_value    TEXT,
  reason       TEXT,
  occurred_at  TEXT NOT NULL DEFAULT (datetime('now')),
  region_id    TEXT REFERENCES regions(id)
) STRICT;
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_trail_time   ON audit_trail(occurred_at DESC);

-- Territory/warehouse scope attached to a user, beyond the single region_id
-- that 0001 put on the users table.
CREATE TABLE user_scopes (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type  TEXT NOT NULL CHECK (scope_type IN ('region', 'warehouse', 'territory')),
  scope_id    TEXT NOT NULL,
  PRIMARY KEY (user_id, scope_type, scope_id)
) STRICT;

-- ======================================================== warehouses =======

CREATE TABLE warehouses (
  id            TEXT PRIMARY KEY,            -- 'wh-north'
  name          TEXT NOT NULL,
  region_id     TEXT REFERENCES regions(id),
  lat           REAL,
  lng           REAL,
  -- Cold-chain capability drives whether a reefer transfer is even possible.
  cold_chain    INTEGER NOT NULL DEFAULT 0 CHECK (cold_chain IN (0, 1)),
  capacity_units INTEGER NOT NULL DEFAULT 0
) STRICT;

-- ================================================ command centre KPIs ======

-- Gross Value at Expiry Risk, snapshotted per region per day so the executive
-- metric is a real time series rather than a number computed once in the UI.
CREATE TABLE expiry_risk_snapshots (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  as_of                 TEXT NOT NULL,       -- 'YYYY-MM-DD'
  region_id             TEXT REFERENCES regions(id),
  window_days           INTEGER NOT NULL DEFAULT 150,
  -- The headline pair: what is exposed, and what interventions have saved.
  gross_value_at_risk_minor INTEGER NOT NULL DEFAULT 0,
  capital_saved_minor       INTEGER NOT NULL DEFAULT 0,
  units_at_risk         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (as_of, region_id, window_days)
) STRICT;
CREATE INDEX idx_expiry_snap ON expiry_risk_snapshots(as_of DESC, region_id);

-- Freshness of the upstream systems of record. "ERP Sync Latency" on the
-- dashboard reads the newest row per system.
CREATE TABLE erp_sync_status (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  system         TEXT NOT NULL,              -- 'SAP S/4HANA', 'Salesforce'
  last_sync_at   TEXT NOT NULL,
  latency_ms     INTEGER NOT NULL,
  records_synced INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'healthy'
                   CHECK (status IN ('healthy', 'lagging', 'failed')),
  recorded_at    TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_erp_sync ON erp_sync_status(system, recorded_at DESC);

-- ========================================================= cold chain ======

CREATE TABLE shipments (
  id              TEXT PRIMARY KEY,          -- 'SHP-10241'
  origin_id       TEXT REFERENCES warehouses(id),
  destination_id  TEXT REFERENCES warehouses(id),
  region_id       TEXT REFERENCES regions(id),
  carrier         TEXT,
  mode            TEXT NOT NULL DEFAULT 'road'
                    CHECK (mode IN ('road', 'air', 'sea', 'rail')),
  status          TEXT NOT NULL DEFAULT 'in_transit'
                    CHECK (status IN ('planned', 'in_transit', 'customs', 'delivered', 'exception')),
  -- The temperature band the payload must stay inside for the whole journey.
  temp_min_c      REAL,
  temp_max_c      REAL,
  departed_at     TEXT,
  eta             TEXT,
  delivered_at    TEXT
) STRICT;
CREATE INDEX idx_shipments_status ON shipments(status, eta);
CREATE INDEX idx_shipments_region ON shipments(region_id);

-- One IoT data logger travelling with a shipment.
CREATE TABLE iot_loggers (
  id            TEXT PRIMARY KEY,            -- 'LGR-88213'
  shipment_id   TEXT REFERENCES shipments(id) ON DELETE CASCADE,
  model         TEXT,
  battery_pct   INTEGER CHECK (battery_pct BETWEEN 0 AND 100),
  last_ping_at  TEXT,
  last_temp_c   REAL,
  last_lat      REAL,
  last_lng      REAL,
  status        TEXT NOT NULL DEFAULT 'reporting'
                  CHECK (status IN ('reporting', 'silent', 'retired'))
) STRICT;
CREATE INDEX idx_loggers_shipment ON iot_loggers(shipment_id);

-- Time series of readings. Excursion variance is computed from these.
CREATE TABLE logger_readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  logger_id   TEXT NOT NULL REFERENCES iot_loggers(id) ON DELETE CASCADE,
  temp_c      REAL NOT NULL,
  lat         REAL,
  lng         REAL,
  recorded_at TEXT NOT NULL
) STRICT;
CREATE INDEX idx_readings_logger_time ON logger_readings(logger_id, recorded_at DESC);

CREATE TABLE route_anomalies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id  TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL
                 CHECK (kind IN ('customs_delay', 'port_congestion', 'temp_excursion',
                                 'route_deviation', 'logger_silent')),
  severity     TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detail       TEXT NOT NULL,
  detected_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
) STRICT;
CREATE INDEX idx_anomalies_open ON route_anomalies(resolved_at, detected_at DESC);

-- ==================================== supply chain physics / freight =======

-- Candidate lanes between two warehouses. The simulator needs cost and
-- reefer availability before it can claim a transfer is viable.
CREATE TABLE freight_lanes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  origin_id         TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  destination_id    TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  mode              TEXT NOT NULL CHECK (mode IN ('road', 'air', 'sea', 'rail')),
  transit_hours     REAL NOT NULL,
  cost_per_unit_minor INTEGER NOT NULL,
  reefer_available  INTEGER NOT NULL DEFAULT 0 CHECK (reefer_available IN (0, 1)),
  -- Worst-case ambient the payload is exposed to on this lane; feeds the
  -- Arrhenius projection and the thermal runway calculation.
  ambient_max_c     REAL,
  UNIQUE (origin_id, destination_id, mode)
) STRICT;

-- Degradation kinetics per SKU. Arrhenius: k = A * exp(-Ea / (R * T)).
-- Storing Ea and a reference point lets the UI draw the curve for any
-- temperature rather than shipping a precomputed series.
CREATE TABLE arrhenius_profiles (
  sku                 TEXT PRIMARY KEY REFERENCES skus(sku) ON DELETE CASCADE,
  activation_energy_kj INTEGER NOT NULL,     -- Ea, kJ/mol
  reference_temp_c    REAL NOT NULL,         -- temperature the shelf life is quoted at
  reference_shelf_days INTEGER NOT NULL,
  -- Below this the API is considered out of specification.
  potency_floor_pct   REAL NOT NULL DEFAULT 90.0
) STRICT;

-- Write-back receipt for an approved transfer. A Stock Transport Order is the
-- SAP document the physical move actually happens against; without this row
-- the app has only recorded an intention.
CREATE TABLE sto_writebacks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id       INTEGER REFERENCES redistribution_plans(id) ON DELETE SET NULL,
  sap_doc_no    TEXT UNIQUE,                 -- NULL until SAP acknowledges
  origin_id     TEXT REFERENCES warehouses(id),
  destination_id TEXT REFERENCES warehouses(id),
  sku           TEXT REFERENCES skus(sku),
  units         INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'acknowledged', 'failed', 'cancelled')),
  requested_by  TEXT REFERENCES users(id),
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT,
  error_detail  TEXT
) STRICT;
CREATE INDEX idx_sto_status ON sto_writebacks(status, requested_at DESC);

-- =================================== commercial truth / field force ========

CREATE TABLE hcps (
  id           TEXT PRIMARY KEY,             -- healthcare professional
  name         TEXT NOT NULL,
  specialty    TEXT,
  clinic_name  TEXT,
  clinic_lat   REAL,
  clinic_lng   REAL,
  -- Metres. A visit ping outside this radius is a geo-fence breach.
  geofence_radius_m INTEGER NOT NULL DEFAULT 150,
  region_id    TEXT REFERENCES regions(id)
) STRICT;

CREATE TABLE stockists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  region_id   TEXT REFERENCES regions(id),
  lat         REAL,
  lng         REAL
) STRICT;

-- Links a chemist/stockist to the doctors it serves, so secondary sales can
-- be triangulated against a rep's claimed visit.
CREATE TABLE stockist_hcp_links (
  stockist_id TEXT NOT NULL REFERENCES stockists(id) ON DELETE CASCADE,
  hcp_id      TEXT NOT NULL REFERENCES hcps(id) ON DELETE CASCADE,
  PRIMARY KEY (stockist_id, hcp_id)
) STRICT;

CREATE TABLE hcp_visits (
  id            TEXT PRIMARY KEY,            -- 'VIS-40021'
  rep_id        TEXT NOT NULL REFERENCES field_reps(id) ON DELETE CASCADE,
  hcp_id        TEXT NOT NULL REFERENCES hcps(id) ON DELETE CASCADE,
  visited_at    TEXT NOT NULL,
  -- Where the rep's device actually reported from.
  ping_lat      REAL,
  ping_lng      REAL,
  distance_m    INTEGER,                     -- from the clinic centroid
  -- 0 = ping fell outside the geofence, i.e. a suspected spoof.
  geo_verified  INTEGER NOT NULL DEFAULT 0 CHECK (geo_verified IN (0, 1)),
  spoof_score   REAL NOT NULL DEFAULT 0,     -- 0..1, model confidence
  region_id     TEXT REFERENCES regions(id)
) STRICT;
CREATE INDEX idx_visits_rep_time ON hcp_visits(rep_id, visited_at DESC);
CREATE INDEX idx_visits_geo      ON hcp_visits(geo_verified);

-- Secondary sales at the stockist, used for the doctor-chemist triangulation:
-- did dispensing actually move after the visit the rep claimed?
CREATE TABLE stockist_sales (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  stockist_id  TEXT NOT NULL REFERENCES stockists(id) ON DELETE CASCADE,
  hcp_id       TEXT REFERENCES hcps(id) ON DELETE SET NULL,
  sku          TEXT REFERENCES skus(sku),
  units        INTEGER NOT NULL,
  value_minor  INTEGER NOT NULL DEFAULT 0,
  sold_on      TEXT NOT NULL                 -- 'YYYY-MM-DD'
) STRICT;
CREATE INDEX idx_stockist_sales ON stockist_sales(hcp_id, sold_on DESC);

CREATE TABLE call_recordings (
  id           TEXT PRIMARY KEY,             -- 'REC-40021'
  visit_id     TEXT NOT NULL REFERENCES hcp_visits(id) ON DELETE CASCADE,
  duration_ms  INTEGER NOT NULL,
  audio_url    TEXT,
  -- Precomputed amplitude envelope for the waveform, as a JSON array of
  -- 0..1 floats. Rendering from raw audio in the browser would mean shipping
  -- the whole file just to draw a preview.
  waveform     TEXT CHECK (waveform IS NULL OR json_valid(waveform)),
  transcribed_at TEXT
) STRICT;

CREATE TABLE call_snippets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recording_id  TEXT NOT NULL REFERENCES call_recordings(id) ON DELETE CASCADE,
  start_ms      INTEGER NOT NULL,
  end_ms        INTEGER NOT NULL,
  label         TEXT NOT NULL,
  transcript    TEXT,
  severity      TEXT NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info', 'positive', 'warning', 'critical')),
  CHECK (end_ms > start_ms)
) STRICT;
CREATE INDEX idx_snippets_rec ON call_snippets(recording_id, start_ms);

CREATE TABLE hcp_objections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id    TEXT NOT NULL REFERENCES hcp_visits(id) ON DELETE CASCADE,
  category    TEXT NOT NULL
                CHECK (category IN ('price_sensitivity', 'efficacy_doubt',
                                    'competitor_loyalty', 'safety_concern',
                                    'formulary_restriction', 'supply_reliability')),
  handled     INTEGER NOT NULL DEFAULT 0 CHECK (handled IN (0, 1)),
  detail      TEXT
) STRICT;
CREATE INDEX idx_objections_visit ON hcp_objections(visit_id);

-- Post-visit prescription lift and sentiment movement, per rep per period.
CREATE TABLE rep_effectiveness (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  rep_id               TEXT NOT NULL REFERENCES field_reps(id) ON DELETE CASCADE,
  period               TEXT NOT NULL,        -- 'YYYY-MM'
  -- Doctor Prescription Rate Index: post-visit script lift, 100 = no change.
  dpri                 REAL NOT NULL DEFAULT 100,
  -- Share of visits where the GPS ping failed the geofence.
  geo_spoof_rate_pct   REAL NOT NULL DEFAULT 0,
  -- Net sentiment movement across calls: conversions vs detractions.
  conversions          INTEGER NOT NULL DEFAULT 0,
  detractions          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rep_id, period)
) STRICT;

-- ============================================= market radar / competitive ==

CREATE TABLE patents (
  id              TEXT PRIMARY KEY,
  molecule        TEXT NOT NULL,
  brand           TEXT,
  holder          TEXT NOT NULL,
  market          TEXT NOT NULL DEFAULT 'IN', -- ISO country / bloc
  exclusivity_type TEXT NOT NULL DEFAULT 'compound'
                    CHECK (exclusivity_type IN ('compound', 'formulation', 'process',
                                                'orphan', 'paediatric_extension')),
  expiry_date     TEXT NOT NULL,             -- 'YYYY-MM-DD' - the LOE date
  annual_value_minor INTEGER NOT NULL DEFAULT 0,
  therapeutic_area TEXT
) STRICT;
CREATE INDEX idx_patents_expiry ON patents(expiry_date);

CREATE TABLE formulary_placements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  network       TEXT NOT NULL,               -- hospital network / payer
  product       TEXT NOT NULL,
  tier          INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  previous_tier INTEGER CHECK (previous_tier BETWEEN 1 AND 5),
  changed_at    TEXT NOT NULL,
  region_id     TEXT REFERENCES regions(id)
) STRICT;
CREATE INDEX idx_formulary_changed ON formulary_placements(changed_at DESC);

-- Ceiling prices published by a regulator (DPCO/NPPA in India), plus
-- approval events from FDA/EMA. One table because the UI treats them as one
-- feed of "regulatory events that move price or access".
CREATE TABLE regulatory_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  authority     TEXT NOT NULL CHECK (authority IN ('NPPA', 'DPCO', 'CDSCO', 'FDA', 'EMA')),
  kind          TEXT NOT NULL
                  CHECK (kind IN ('ceiling_price', 'approval', 'recall', 'label_change')),
  product       TEXT NOT NULL,
  -- Populated for ceiling_price events only.
  ceiling_price_minor INTEGER,
  previous_price_minor INTEGER,
  detail        TEXT,
  effective_from TEXT NOT NULL,
  published_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_regevents_time ON regulatory_events(published_at DESC);

CREATE TABLE share_of_voice (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  therapeutic_area TEXT NOT NULL,
  company          TEXT NOT NULL,
  period           TEXT NOT NULL,            -- 'YYYY-MM'
  sov_pct          REAL NOT NULL CHECK (sov_pct >= 0),
  -- 1 when the row is us rather than a competitor, so the UI can highlight it
  -- without hardcoding a company name.
  is_own           INTEGER NOT NULL DEFAULT 0 CHECK (is_own IN (0, 1)),
  UNIQUE (therapeutic_area, company, period)
) STRICT;

CREATE TABLE clinical_trials (
  id             TEXT PRIMARY KEY,           -- registry id, e.g. NCT number
  sponsor        TEXT NOT NULL,
  molecule       TEXT NOT NULL,
  therapeutic_area TEXT,
  phase          TEXT NOT NULL CHECK (phase IN ('preclinical', 'I', 'II', 'III', 'IV')),
  status         TEXT NOT NULL DEFAULT 'recruiting'
                   CHECK (status IN ('planned', 'recruiting', 'active', 'completed', 'terminated')),
  started_at     TEXT,
  est_completion TEXT,
  -- Days ahead (negative) or behind (positive) the sponsor's original plan.
  schedule_delta_days INTEGER NOT NULL DEFAULT 0,
  is_own         INTEGER NOT NULL DEFAULT 0 CHECK (is_own IN (0, 1))
) STRICT;
CREATE INDEX idx_trials_phase ON clinical_trials(phase, status);

-- ====================================================== drug discovery =====

CREATE TABLE discovery_programs (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  therapeutic_area TEXT NOT NULL,
  target           TEXT,                     -- protein / gene symbol
  phase            TEXT NOT NULL DEFAULT 'discovery'
                     CHECK (phase IN ('discovery', 'preclinical', 'I', 'II', 'III', 'submitted')),
  lead_user_id     TEXT REFERENCES users(id),
  started_at       TEXT,
  -- Probability of technical and regulatory success, 0..1.
  ptrs             REAL CHECK (ptrs BETWEEN 0 AND 1)
) STRICT;

-- A 3D disease model: nodes are biological entities positioned in space,
-- edges are interactions. Geometry is stored as JSON rather than as rows
-- because it is read whole, on every render, and never queried by field.
CREATE TABLE disease_models (
  id           TEXT PRIMARY KEY,
  program_id   TEXT REFERENCES discovery_programs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  disease      TEXT NOT NULL,
  model_type   TEXT NOT NULL DEFAULT 'pathway'
                 CHECK (model_type IN ('pathway', 'protein', 'tissue', 'pk_pd')),
  summary      TEXT,
  -- [{ id, label, kind, x, y, z, radius, expression }]
  nodes        TEXT NOT NULL CHECK (json_valid(nodes)),
  -- [{ source, target, kind, weight }]
  edges        TEXT NOT NULL CHECK (json_valid(edges)),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE compound_candidates (
  id             TEXT PRIMARY KEY,
  program_id     TEXT NOT NULL REFERENCES discovery_programs(id) ON DELETE CASCADE,
  code_name      TEXT NOT NULL,
  -- Standard early-discovery readouts.
  binding_affinity_nm REAL,                  -- lower is stronger
  selectivity_fold REAL,
  admet_score    REAL CHECK (admet_score BETWEEN 0 AND 100),
  status         TEXT NOT NULL DEFAULT 'screening'
                   CHECK (status IN ('screening', 'hit', 'lead', 'optimised', 'dropped'))
) STRICT;
CREATE INDEX idx_candidates_program ON compound_candidates(program_id, status);

-- ================================================= system status extras ====

-- Inference latency for models served behind Triton.
CREATE TABLE inference_metrics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  model        TEXT NOT NULL,                -- 'bionemo-esm2', 'logistics-gnn'
  p50_ms       REAL NOT NULL,
  p95_ms       REAL NOT NULL,
  queue_depth  INTEGER NOT NULL DEFAULT 0,
  gpu_util_pct REAL,
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_inference_time ON inference_metrics(model, recorded_at DESC);

-- Throughput of the distributor EDI/CSV ingestion pipeline.
CREATE TABLE ingestion_throughput (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL,             -- 'Distributor EDI', 'CSV Upload'
  records_per_sec REAL NOT NULL,
  backlog_records INTEGER NOT NULL DEFAULT 0,
  recorded_at     TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
CREATE INDEX idx_ingest_time ON ingestion_throughput(source, recorded_at DESC);

-- ============================================== column additions ===========

-- Links onto the existing tables from 0001. Added rather than redefined:
-- ALTER ... ADD COLUMN is the only in-place change SQLite supports, and both
-- default to NULL so no backfill is required.

-- Corporate designation replaces the gamified "rank" the profile screen showed.
ALTER TABLE users ADD COLUMN designation_id TEXT REFERENCES designations(id);
-- Display currency preference. NULL means fall back to the workspace default.
ALTER TABLE users ADD COLUMN preferred_currency TEXT REFERENCES currencies(code);

-- Which warehouse physically holds a batch. Needed before the simulator can
-- tell whether moving stock would induce a stockout at the source.
ALTER TABLE inventory_batches ADD COLUMN warehouse_id TEXT REFERENCES warehouses(id);
-- Reorder point for the stockout-inversion check.
ALTER TABLE inventory_batches ADD COLUMN safety_stock_units INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_batches_warehouse ON inventory_batches(warehouse_id);

-- ===========================================================================
-- PORTING NOTES (Postgres deltas, extending the list in 0001)
--
--   * STRICT           -> drop; Postgres is typed already.
--   * TEXT timestamps  -> timestamptz.
--   * json_valid(x)    -> use jsonb and drop the CHECK.
--   * INTEGER 0/1 flags-> boolean.
--   * AUTOINCREMENT    -> GENERATED ALWAYS AS IDENTITY.
--   * audit_trail should additionally be protected by a REVOKE of
--     UPDATE/DELETE from the application role. SQLite/D1 cannot express that,
--     so on D1 the append-only property is enforced only by convention -
--     nothing in backend/src issues UPDATE or DELETE against it.
-- ===========================================================================
