-- ===========================================================================
-- Seed data.
--
-- Reference rows the app needs to render, plus the bootstrap admin.
-- Safe to re-run: every statement is INSERT OR IGNORE.
-- ===========================================================================

INSERT OR IGNORE INTO regions (id, name) VALUES
  ('north', 'North'), ('south', 'South'), ('east', 'East'), ('west', 'West');

-- ---------------------------------------------------------------------------
-- BOOTSTRAP ADMIN - edit this line before applying.
--
-- Chicken-and-egg: onboarding happens through /api/admin/users, which is
-- admin-only, so the first admin cannot be invited through the app. Seeding
-- the row here is the whole bootstrap - status stays 'invited' until this
-- person signs in with Google, at which point google_sub binds and it flips
-- to 'active'. The email must match their Google account exactly.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO users (id, email, name, role, status) VALUES
  ('admin-bootstrap',    'daskoustav04@gmail.com',        'Koustav Das', 'admin', 'invited'),
  ('admin-bootstrap-ws', 'koustav.das@analyzehive.com',   'Koustav Das', 'admin', 'invited');

-- ---------------------------------------------------------------------- ops --

INSERT OR IGNORE INTO skus (sku, name) VALUES
  ('SKU-9988', 'Insulin Glargine 100U/ml'),
  ('SKU-7721', 'Atorvastatin 40mg'),
  ('SKU-5532', 'Metformin XR 1000mg'),
  ('SKU-3345', 'Omeprazole 20mg'),
  ('SKU-4471', 'Losartan 50mg'),
  ('SKU-6620', 'Azithromycin 500mg'),
  ('SKU-8890', 'Pantoprazole 40mg'),
  ('SKU-2234', 'Amlodipine 5mg');

-- Expiry dates are relative to seed time so "days to expiry" stays meaningful
-- instead of drifting into the past. Values are integer paise.
INSERT OR IGNORE INTO inventory_batches
  (batch_code, sku, region_id, quantity, value_minor, expiry_date, status) VALUES
  ('P-001245', 'SKU-9988', 'north', 3000, 5200000, date('now', '+120 days'), 'Critical'),
  ('P-001246', 'SKU-7721', 'west',  1800, 2800000, date('now', '+145 days'), 'Warning'),
  ('P-001247', 'SKU-5532', 'east',  2400, 1500000, date('now', '+156 days'), 'Good'),
  ('P-001248', 'SKU-3345', 'south', 1200, 2200000, date('now', '+180 days'), 'Good'),
  ('P-001249', 'SKU-4471', 'north',  900, 1950000, date('now',  '+98 days'), 'Critical'),
  ('P-001250', 'SKU-6620', 'west',  1500, 3120000, date('now', '+132 days'), 'Warning'),
  ('P-001251', 'SKU-8890', 'east',  2100, 1280000, date('now', '+167 days'), 'Good'),
  ('P-001252', 'SKU-2234', 'south', 3300,  940000, date('now', '+175 days'), 'Good');

INSERT OR IGNORE INTO alerts (id, level, title, description, detail, region_id, created_at) VALUES
  (1, 'critical', 'Amoxicillin batch at risk', '92% probability of expiry breach',
   'Batch P-001245 is projected to breach expiry before it clears current warehouse stock. GPS-tagged transit logs show a 6-day dwell time at the North distribution hub, well above the 2-day target. Recommend immediate redistribution to a high-turnover region.',
   'north', datetime('now', '-2 hours')),
  (2, 'warning', 'Cold chain deviation', 'Warehouse A temperature spike',
   'Warehouse A sensor logged a temperature spike to 9.2°C at 13:11, exceeding the 8°C cold-chain threshold for 14 minutes before recovering. No product loss confirmed yet; flagged for QA review.',
   'north', datetime('now', '-3 hours'));

INSERT OR IGNORE INTO notifications (id, title, message, created_at) VALUES
  (1, 'Batch flagged',   'P-001245 (Amoxicillin) crossed 90% expiry risk.',  datetime('now', '-2 minutes')),
  (2, 'Sync complete',   'Salesforce data sync finished with 0 errors.',      datetime('now', '-12 minutes')),
  (3, 'New audit flag',  'R. Patel''s hierarchy audit was flagged for review.', datetime('now', '-34 minutes'));

-- ------------------------------------------------------------- market radar --

INSERT OR IGNORE INTO market_signals (id, source, title, sentiment, impact, detected_at) VALUES
  (1, 'PubMed',      'Competitor X launched new diabetic study with promising Phase II results', 'positive', 'High',     datetime('now', '-2 minutes')),
  (2, 'Twitter/X',   'Rising discussions about Competitor Y pricing strategy in West region',    'neutral',  'Medium',   datetime('now', '-15 minutes')),
  (3, 'News Alert',  'Competitor Z receives FDA approval for new cardiovascular drug',           'critical', 'Critical', datetime('now', '-42 minutes')),
  (4, 'LinkedIn',    'VP of Sales at Competitor A posts about expansion into APAC',              'positive', 'Low',      datetime('now', '-1 hour')),
  (5, 'MarketWatch', 'Sector analysis predicts 15% growth in biologics for Q3',                  'neutral',  'Medium',   datetime('now', '-2 hours')),
  (6, 'Regulatory',  'New compliance standards issued for medical device packaging',             'critical', 'High',     datetime('now', '-4 hours'));

INSERT OR IGNORE INTO network_nodes (id, name, kind, status) VALUES
  ('A', 'Competitor A', 'competitor', 'active'),
  ('B', 'Competitor B', 'competitor', 'stable'),
  ('C', 'Market C',     'market',     'softening'),
  ('D', 'Supplier D',   'supplier',   'flagged');

INSERT OR IGNORE INTO node_analyses (id, node_id, summary, recommendation) VALUES
  (1, 'A', 'Competitor A is aggressively expanding into APAC, with 3 major signals detected in the past 24h.',
       'Monitor West-region pricing closely; consider a defensive campaign in APAC within 30 days.'),
  (2, 'B', 'Competitor B activity is stable with no material threats this period.', 'No immediate action required.'),
  (3, 'C', 'Market C shows early signs of demand softening.', 'Re-evaluate Q3 allocation forecasts for this market.'),
  (4, 'D', 'Supplier D flagged for regulatory correlation risk.', 'Request updated compliance documentation from Supplier D within 2 weeks.');

INSERT OR IGNORE INTO node_analysis_activity (analysis_id, ordinal, activity) VALUES
  (1, 0, 'VP of Sales publicly discussed APAC expansion plans'),
  (1, 1, 'Filed 2 new regional distribution licenses'),
  (1, 2, 'Increased ad spend by an estimated 18% week-over-week'),
  (2, 0, 'Routine quarterly earnings call, no strategic shifts announced'),
  (3, 0, 'Sector analysis predicts slower biologics growth for Q3'),
  (4, 0, 'New compliance standards issued affecting packaging suppliers');

-- --------------------------------------------------------- commercial truth --
-- manager_id makes this the tree the page always claimed to show.

INSERT OR IGNORE INTO field_reps (id, name, title, initials, color, team_size, region_id, manager_id) VALUES
  ('AR', 'A. Reddy',   'Zone Manager',   'AR', 'bg-indigo-500',  45, 'south', NULL),
  ('SK', 'S. Kumar',   'Regional Lead',  'SK', 'bg-blue-500',    24, 'west',  'AR'),
  ('RP', 'R. Patel',   'Area Manager',   'RP', 'bg-emerald-500',  8, 'north', 'SK'),
  ('MS', 'M. Singh',   'Area Manager',   'MS', 'bg-purple-500',   6, 'north', 'SK'),
  ('KJ', 'K. Johnson', 'Area Manager',   'KJ', 'bg-orange-500',  12, 'east',  'AR'),
  ('LW', 'L. Wei',     'City Lead',      'LW', 'bg-pink-500',     5, 'west',  'SK');

INSERT OR IGNORE INTO rep_metrics (rep_id, period, reported, verified, status) VALUES
  ('RP', strftime('%Y-%m','now'), 98, 72, 'Flagged'),
  ('SK', strftime('%Y-%m','now'), 95, 91, 'Verified'),
  ('MS', strftime('%Y-%m','now'), 92, 58, 'Flagged'),
  ('AR', strftime('%Y-%m','now'), 88, 85, 'Verified'),
  ('KJ', strftime('%Y-%m','now'), 99, 96, 'Verified'),
  ('LW', strftime('%Y-%m','now'), 85, 60, 'Flagged');

INSERT OR IGNORE INTO audit_events (id, rep_id, event, flagged, occurred_at) VALUES
  (1, 'RP', 'GPS check-in logged at Warehouse North (unverified)',              0, datetime('now', '-3 days', '+9 hours')),
  (2, 'RP', 'Reported 4 client visits; 1 GPS-corroborated',                     0, datetime('now', '-3 days', '+11 hours')),
  (3, 'RP', 'Flagged: reported location does not match device GPS trail',       1, datetime('now', '-3 days', '+13 hours')),
  (4, 'MS', 'Reported 6 client visits; 2 GPS-corroborated',                     0, datetime('now', '-4 days', '+10 hours')),
  (5, 'MS', 'Flagged: call duration mismatch with reported visit length',       1, datetime('now', '-4 days', '+16 hours')),
  (6, 'LW', 'Reported 3 client visits; 1 GPS-corroborated',                     0, datetime('now', '-5 days', '+14 hours')),
  (7, 'LW', 'Flagged: duplicate visit report across two clients',               1, datetime('now', '-5 days', '+17 hours'));

-- ------------------------------------------------------------ supply chain --

INSERT OR IGNORE INTO redistribution_plans (id, summary, status) VALUES
  (1, 'Redistribute surplus stock from Warehouse North to Warehouse West to avoid an estimated ₹2.6Cr in expiry losses over the next 45 days.', 'draft');

INSERT OR IGNORE INTO redistribution_steps (plan_id, ordinal, instruction) VALUES
  (1, 0, 'Transfer 3,000 units of high-risk SKUs from Warehouse North to Warehouse West'),
  (1, 1, 'Prioritize SKU-9988 (Insulin Glargine) and SKU-4471 (Losartan) - both under 100 days to critical'),
  (1, 2, 'Schedule transfer window within 72 hours to stay ahead of demand ramp in West'),
  (1, 3, 'Re-run risk scoring after transfer completes to confirm exposure reduction');

-- ----------------------------------------------------------- system status --

INSERT OR IGNORE INTO services (id, name, region, status, uptime_pct) VALUES
  (1, 'Authentication Service',  'Global',  'Operational', 99.99),
  (2, 'Data Ingestion Pipeline', 'US-East', 'Operational', 99.95),
  (3, 'Notification Engine',     'EU-West', 'Degraded',    98.50),
  (4, 'Payment Gateway',         'Global',  'Operational', 100.00),
  (5, 'AI Inference Cluster',    'APAC',    'Operational', 99.90),
  (6, 'Reporting API',           'US-West', 'Maintenance', NULL);

INSERT OR IGNORE INTO service_checks (service_id, latency_ms) VALUES
  (1, 24), (2, 145), (3, 410), (4, 89), (5, 310);

INSERT OR IGNORE INTO incidents (id, title, severity, status, started_at, resolved_at) VALUES
  (1, 'High Latency in EU-West',          'Medium', 'Investigating', datetime('now', '-12 minutes'), NULL),
  (2, 'API Rate Limit Adjusted',          'Low',    'Resolved',      datetime('now', '-2 hours'),    datetime('now', '-1 hour')),
  (3, 'Scheduled Maintenance: Reports',   'Info',   'Completed',     datetime('now', '-1 day'),      datetime('now', '-20 hours'));
