-- ===========================================================================
-- AnalyzeHive Nexus - pharmaceutical domain seed
--
-- Companion to 0003. Idempotent (INSERT OR IGNORE / UPDATE) so it can be
-- re-run without duplicating rows.
--
-- Money is INR paise throughout, matching 0001's inventory_batches.value_minor.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------- currency ---

INSERT OR IGNORE INTO currencies (code, symbol, name, minor_units, locale) VALUES
  ('INR', '₹', 'Indian Rupee',   100, 'en-IN'),
  ('USD', '$', 'US Dollar',      100, 'en-US'),
  ('EUR', '€', 'Euro',           100, 'de-DE'),
  ('GBP', '£', 'Pound Sterling', 100, 'en-GB');

-- Indicative rates. rate_from_inr = target minor units per 1 INR paise.
INSERT OR IGNORE INTO fx_rates (code, rate_from_inr, as_of) VALUES
  ('INR', 1.0,      datetime('now')),
  ('USD', 0.01126,  datetime('now')),
  ('EUR', 0.01042,  datetime('now')),
  ('GBP', 0.00889,  datetime('now'));

-- ----------------------------------------------------------- governance ---

INSERT OR IGNORE INTO designations (id, title, department, grade) VALUES
  ('head-global-supply',    'Head of Global Supply',          'Supply Chain',        9),
  ('regional-compliance',   'Regional Compliance Officer',    'Quality & Compliance', 7),
  ('qa-director',           'Director, Quality Assurance',    'Quality & Compliance', 8),
  ('supply-analyst',        'Supply Chain Analyst',           'Supply Chain',        4),
  ('field-force-manager',   'Field Force Effectiveness Manager', 'Commercial',       6),
  ('discovery-lead',        'Discovery Program Lead',         'R&D',                 8),
  ('cold-chain-lead',       'Cold Chain Operations Lead',     'Logistics',           6);

INSERT OR IGNORE INTO permissions (id, description, requires_signature) VALUES
  ('supply.view',             'View inventory and redistribution plans',            0),
  ('supply.simulate',         'Run redistribution simulations',                     0),
  ('supply.approve_transfer', 'Approve a stock transfer and raise an SAP STO',      1),
  ('batch.release',           'Release a batch to saleable stock',                  1),
  ('audit.view',              'View the Part 11 audit trail',                       0),
  ('audit.export',            'Export the audit trail for an inspection',           1),
  ('commercial.view',         'View field force audit data',                        0),
  ('commercial.flag_rep',     'Flag a representative for investigation',            1),
  ('discovery.view',          'View discovery programs and disease models',         0),
  ('admin.manage_users',      'Invite, suspend and re-role users',                  0);

INSERT OR IGNORE INTO role_permissions (role, permission_id) VALUES
  ('admin','supply.view'),('admin','supply.simulate'),('admin','supply.approve_transfer'),
  ('admin','batch.release'),('admin','audit.view'),('admin','audit.export'),
  ('admin','commercial.view'),('admin','commercial.flag_rep'),('admin','discovery.view'),
  ('admin','admin.manage_users'),
  ('manager','supply.view'),('manager','supply.simulate'),('manager','supply.approve_transfer'),
  ('manager','audit.view'),('manager','commercial.view'),('manager','discovery.view'),
  ('employee','supply.view'),('employee','commercial.view'),('employee','discovery.view');

-- Give the bootstrap admins a designation rather than a "rank".
UPDATE users SET designation_id = 'head-global-supply', preferred_currency = 'INR'
 WHERE id = 'admin-bootstrap' AND designation_id IS NULL;
UPDATE users SET designation_id = 'regional-compliance', preferred_currency = 'INR'
 WHERE id = 'admin-bootstrap-ws' AND designation_id IS NULL;

INSERT OR IGNORE INTO signature_credentials (id, user_id, issued_at, expires_at, status) VALUES
  ('SIG-AH-00417', 'admin-bootstrap',    datetime('now','-240 days'), datetime('now','+125 days'), 'active'),
  ('SIG-AH-00418', 'admin-bootstrap-ws', datetime('now','-180 days'), datetime('now','+185 days'), 'active');

INSERT OR IGNORE INTO part11_signoffs
  (id, user_id, credential_id, record_type, record_id, meaning, signed_at, payload_hash) VALUES
  (1,'admin-bootstrap','SIG-AH-00417','redistribution_plan','1','approved',   datetime('now','-9 days'),  'a3f1c9e77b2d4e08'),
  (2,'admin-bootstrap','SIG-AH-00417','batch_release','P-001247','responsibility', datetime('now','-6 days'), 'c81b4472ff0a9d13'),
  (3,'admin-bootstrap-ws','SIG-AH-00418','audit_export','Q3-FY26','reviewed', datetime('now','-3 days'),  '55de10bb90c7a284'),
  (4,'admin-bootstrap','SIG-AH-00417','batch_release','P-001251','approved',  datetime('now','-1 days'),  '7b0e33aa14cc65f9');

INSERT OR IGNORE INTO audit_trail
  (id, user_id, action, entity_type, entity_id, field, old_value, new_value, reason, occurred_at, region_id) VALUES
  (1,'admin-bootstrap','update','inventory_batch','P-001245','status','Warning','Critical','Stability excursion recorded in transit', datetime('now','-5 days'),'north'),
  (2,'admin-bootstrap','sign','redistribution_plan','1',NULL,NULL,'approved','Transfer authorised under SOP-SC-014', datetime('now','-9 days'),'north'),
  (3,'admin-bootstrap-ws','update','hcp_visit','VIS-40023','geo_verified','1','0','GPS ping outside clinic geofence', datetime('now','-2 days'),'west'),
  (4,'admin-bootstrap','create','sto_writeback','1',NULL,NULL,'pending','Raised from redistribution simulator', datetime('now','-9 days'),'north'),
  (5,'admin-bootstrap-ws','update','user','admin-bootstrap','designation_id',NULL,'head-global-supply','Onboarding', datetime('now','-30 days'),NULL);

INSERT OR IGNORE INTO user_scopes (user_id, scope_type, scope_id) VALUES
  ('admin-bootstrap','region','north'),('admin-bootstrap','region','west'),
  ('admin-bootstrap','warehouse','wh-north'),('admin-bootstrap','warehouse','wh-west'),
  ('admin-bootstrap-ws','region','west'),('admin-bootstrap-ws','territory','MENA');

-- ----------------------------------------------------------- warehouses ---

INSERT OR IGNORE INTO warehouses (id, name, region_id, lat, lng, cold_chain, capacity_units) VALUES
  ('wh-north','Warehouse North - Ludhiana', 'north', 30.9010, 75.8573, 1, 42000),
  ('wh-west', 'Warehouse West - Bhiwandi',  'west',  19.2965, 73.0630, 1, 58000),
  ('wh-south','Warehouse South - Hosur',    'south', 12.7409, 77.8253, 0, 36000),
  ('wh-east', 'Warehouse East - Kolkata',   'east',  22.5726, 88.3639, 1, 31000);

UPDATE inventory_batches SET warehouse_id = 'wh-north', safety_stock_units = 1200 WHERE region_id='north' AND warehouse_id IS NULL;
UPDATE inventory_batches SET warehouse_id = 'wh-west',  safety_stock_units =  900 WHERE region_id='west'  AND warehouse_id IS NULL;
UPDATE inventory_batches SET warehouse_id = 'wh-south', safety_stock_units =  800 WHERE region_id='south' AND warehouse_id IS NULL;
UPDATE inventory_batches SET warehouse_id = 'wh-east',  safety_stock_units =  700 WHERE region_id='east'  AND warehouse_id IS NULL;

-- ------------------------------------------------- command centre KPIs ----

-- 30 days of GVER / capital-saved history per region, generated rather than
-- typed out. The recursive CTE keeps the seed short and the series smooth.
INSERT OR IGNORE INTO expiry_risk_snapshots
  (as_of, region_id, window_days, gross_value_at_risk_minor, capital_saved_minor, units_at_risk)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM d WHERE n < 29)
SELECT date('now', '-' || n || ' days'),
       r.id,
       150,
       -- ~Rs 2.5 Cr exposed per region (Rs 10 Cr group-wide), against the
       -- Rs 103 Cr total inventory the KPI row reports.
       CAST(2450000000 + (abs(random()) % 220000000) - (n * 5200000) AS INTEGER),
       CAST( 360000000 + (abs(random()) %  60000000) + (n * 2400000) AS INTEGER),
       CAST(      4200 + (abs(random()) % 900)       - (n * 12)      AS INTEGER)
  FROM d CROSS JOIN regions r;

INSERT OR IGNORE INTO erp_sync_status (id, system, last_sync_at, latency_ms, records_synced, status, recorded_at) VALUES
  (1,'SAP S/4HANA',       datetime('now','-2 minutes'),  412, 184220,'healthy', datetime('now')),
  (2,'Salesforce Veeva',  datetime('now','-6 minutes'),  980,  42117,'healthy', datetime('now')),
  (3,'Distributor EDI',   datetime('now','-31 minutes'),3120, 512884,'lagging', datetime('now')),
  (4,'LIMS (Quality)',    datetime('now','-4 minutes'),  655,   8140,'healthy', datetime('now'));

-- ------------------------------------------------------------ cold chain --

INSERT OR IGNORE INTO shipments
  (id, origin_id, destination_id, region_id, carrier, mode, status, temp_min_c, temp_max_c, departed_at, eta) VALUES
  ('SHP-10241','wh-north','wh-west','north','Blue Dart Temperature Logistics','road','in_transit', 2, 8, datetime('now','-19 hours'), datetime('now','+7 hours')),
  ('SHP-10242','wh-west','wh-south','west','Snowman Logistics','road','in_transit',       2, 8, datetime('now','-8 hours'),  datetime('now','+16 hours')),
  ('SHP-10243','wh-east','wh-north','east','Gati Kausar','road','customs',                2, 8, datetime('now','-32 hours'), datetime('now','+11 hours')),
  ('SHP-10244','wh-west','wh-east','west','DHL Life Sciences','air','in_transit',       -20,-15, datetime('now','-5 hours'),  datetime('now','+4 hours')),
  ('SHP-10245','wh-south','wh-west','south','TCI Cold Chain','road','exception',          2, 8, datetime('now','-27 hours'), datetime('now','+2 hours')),
  ('SHP-10246','wh-north','wh-east','north','Snowman Logistics','rail','delivered',       2, 8, datetime('now','-3 days'),   datetime('now','-9 hours'));

INSERT OR IGNORE INTO iot_loggers (id, shipment_id, model, battery_pct, last_ping_at, last_temp_c, last_lat, last_lng, status) VALUES
  ('LGR-88213','SHP-10241','Elpro LIBERO CE', 87, datetime('now','-3 minutes'),  5.4, 26.9124, 75.7873,'reporting'),
  ('LGR-88214','SHP-10242','Sensitech TempTale',72, datetime('now','-2 minutes'), 6.1, 16.5062, 74.2433,'reporting'),
  ('LGR-88215','SHP-10243','Elpro LIBERO CE', 41, datetime('now','-4 minutes'),  7.2, 24.5854, 84.9964,'reporting'),
  ('LGR-88216','SHP-10244','Controlant Saga', 93, datetime('now','-1 minutes'), -17.8, 21.1458, 79.0882,'reporting'),
  ('LGR-88217','SHP-10245','Sensitech TempTale',18, datetime('now','-96 minutes'),11.9, 14.4426, 78.8242,'silent'),
  ('LGR-88218','SHP-10241','Controlant Saga', 90, datetime('now','-3 minutes'),  5.1, 26.9124, 75.7873,'reporting');

-- 24 readings per active logger, one per hour.
INSERT OR IGNORE INTO logger_readings (logger_id, temp_c, lat, lng, recorded_at)
WITH RECURSIVE h(n) AS (SELECT 0 UNION ALL SELECT n+1 FROM h WHERE n < 23)
SELECT l.id,
       -- Readings must sit inside each SHIPMENT's own band, not a hardcoded
       -- 2-8C: SHP-10244 is a frozen lane (-20..-15C) and 5C there would be a
       -- 20-degree excursion that never happened.
       CASE WHEN l.id IN ('LGR-88217','LGR-88215')
            -- Deliberate excursion cases: drift above the ceiling.
            THEN s.temp_max_c + 0.5 + (abs(random()) % 400) / 100.0
            ELSE s.temp_min_c + 0.5
                 + (abs(random()) % CAST(MAX((s.temp_max_c - s.temp_min_c - 1) * 100, 1) AS INTEGER)) / 100.0
       END,
       l.last_lat, l.last_lng,
       datetime('now', '-' || n || ' hours')
  FROM h
  CROSS JOIN iot_loggers l
  JOIN shipments s ON s.id = l.shipment_id
 WHERE l.status <> 'retired';

INSERT OR IGNORE INTO route_anomalies (id, shipment_id, kind, severity, detail, detected_at, resolved_at) VALUES
  (1,'SHP-10243','customs_delay','high','Held at Petrapole checkpoint - CDSCO NOC pending', datetime('now','-6 hours'), NULL),
  (2,'SHP-10245','temp_excursion','critical','11.9C recorded for 42 minutes, band is 2-8C', datetime('now','-2 hours'), NULL),
  (3,'SHP-10245','logger_silent','high','LGR-88217 has not reported for 96 minutes', datetime('now','-40 minutes'), NULL),
  (4,'SHP-10242','route_deviation','low','18km off planned corridor near Kolhapur', datetime('now','-3 hours'), NULL),
  (5,'SHP-10241','port_congestion','medium','Dwell time exceeded at Jaipur hub', datetime('now','-11 hours'), datetime('now','-5 hours'));

-- --------------------------------------------------- freight & kinetics ---

INSERT OR IGNORE INTO freight_lanes
  (origin_id, destination_id, mode, transit_hours, cost_per_unit_minor, reefer_available, ambient_max_c) VALUES
  ('wh-north','wh-west','road', 26.0, 1450, 1, 34.0),
  ('wh-north','wh-west','air',   4.5, 7900, 1, 22.0),
  ('wh-west','wh-south','road', 18.5, 1180, 1, 36.0),
  ('wh-east','wh-north','road', 41.0, 2050, 1, 31.0),
  ('wh-west','wh-east','air',    5.0, 8600, 1, 24.0),
  ('wh-south','wh-west','road', 19.0, 1220, 0, 38.0),
  ('wh-north','wh-east','rail', 52.0,  870, 1, 29.0);

INSERT OR IGNORE INTO arrhenius_profiles
  (sku, activation_energy_kj, reference_temp_c, reference_shelf_days, potency_floor_pct) VALUES
  ('SKU-9988', 83, 5.0,  730, 95.0),   -- Insulin, cold chain, steep
  ('SKU-7721', 96, 25.0, 1095, 90.0),
  ('SKU-5532', 88, 25.0, 1095, 90.0),
  ('SKU-3345', 79, 25.0,  730, 90.0),
  ('SKU-4471', 92, 25.0, 1095, 90.0),
  ('SKU-6620', 85, 25.0,  912, 90.0),
  ('SKU-8890', 81, 25.0,  730, 90.0),
  ('SKU-2234', 94, 25.0, 1095, 90.0);

INSERT OR IGNORE INTO sto_writebacks
  (id, plan_id, sap_doc_no, origin_id, destination_id, sku, units, status, requested_by, requested_at, acknowledged_at) VALUES
  (1, NULL,'4500019823','wh-north','wh-west','SKU-9988', 3000,'acknowledged','admin-bootstrap', datetime('now','-9 days'), datetime('now','-9 days')),
  (2, NULL,'4500019841','wh-east','wh-north','SKU-8890', 1200,'acknowledged','admin-bootstrap', datetime('now','-4 days'), datetime('now','-4 days')),
  (3, NULL, NULL,       'wh-south','wh-west','SKU-2234',  800,'pending',     'admin-bootstrap', datetime('now','-2 hours'), NULL);

-- ------------------------------------------------ commercial truth data ---

INSERT OR IGNORE INTO hcps (id, name, specialty, clinic_name, clinic_lat, clinic_lng, geofence_radius_m, region_id) VALUES
  ('HCP-2201','Dr. Ananya Iyer',    'Endocrinology','Iyer Diabetes Centre',    19.1136, 72.8697, 150,'west'),
  ('HCP-2202','Dr. Rakesh Menon',   'Cardiology',   'Menon Heart Clinic',      30.9010, 75.8573, 120,'north'),
  ('HCP-2203','Dr. Sunita Bhatt',   'Gastroenterology','Bhatt Digestive Care', 22.5726, 88.3639, 200,'east'),
  ('HCP-2204','Dr. Vivek Raman',    'General Medicine','Raman Polyclinic',     12.9716, 77.5946, 150,'south'),
  ('HCP-2205','Dr. Priya Deshmukh', 'Endocrinology','Deshmukh Metabolic Unit', 18.5204, 73.8567, 130,'west'),
  ('HCP-2206','Dr. Imran Qureshi',  'Nephrology',   'Qureshi Renal Institute', 28.6139, 77.2090, 180,'north');

INSERT OR IGNORE INTO stockists (id, name, region_id, lat, lng) VALUES
  ('STK-501','Meridian Pharma Distributors','west', 19.1150, 72.8710),
  ('STK-502','Northgate Medical Supplies',  'north',30.9020, 75.8590),
  ('STK-503','Bengal Health Traders',       'east', 22.5740, 88.3650),
  ('STK-504','Deccan Drug House',           'south',12.9720, 77.5960);

INSERT OR IGNORE INTO stockist_hcp_links (stockist_id, hcp_id) VALUES
  ('STK-501','HCP-2201'),('STK-501','HCP-2205'),('STK-502','HCP-2202'),
  ('STK-502','HCP-2206'),('STK-503','HCP-2203'),('STK-504','HCP-2204');

-- Visits sit far enough back that the +/-7 day triangulation windows around
-- each one are fully populated. A visit dated 'yesterday' has no 'after'
-- window yet, which reads as a -100% collapse rather than "too early to say".
INSERT OR IGNORE INTO hcp_visits
  (id, rep_id, hcp_id, visited_at, ping_lat, ping_lng, distance_m, geo_verified, spoof_score, region_id) VALUES
  ('VIS-40021','SK','HCP-2201', datetime('now','-12 days'), 19.1137, 72.8698,  14, 1, 0.02,'west'),
  ('VIS-40022','RP','HCP-2202', datetime('now','-13 days'), 30.9012, 75.8575,  26, 1, 0.05,'north'),
  ('VIS-40023','MS','HCP-2206', datetime('now','-13 days'), 28.6402, 77.2410, 4380, 0, 0.91,'north'),
  ('VIS-40024','LW','HCP-2205', datetime('now','-14 days'), 18.5206, 73.8570,  38, 1, 0.08,'west'),
  ('VIS-40025','KJ','HCP-2203', datetime('now','-14 days'), 22.5731, 88.3644,  72, 1, 0.11,'east'),
  ('VIS-40026','LW','HCP-2204', datetime('now','-15 days'), 12.9880, 77.6210, 3110, 0, 0.84,'south'),
  ('VIS-40027','SK','HCP-2205', datetime('now','-16 days'), 18.5205, 73.8568,  22, 1, 0.03,'west'),
  ('VIS-40028','AR','HCP-2201', datetime('now','-17 days'), 19.1139, 72.8701,  47, 1, 0.06,'west');

-- Paired around each visit: one sale inside the 7 days BEFORE it (the
-- baseline) and one inside the 7 days AFTER (the lift). Reps whose GPS ping
-- failed the geofence show flat or falling secondary sales, which is the whole
-- point of triangulating the two signals against each other.
INSERT OR IGNORE INTO stockist_sales (stockist_id, hcp_id, sku, units, value_minor, sold_on) VALUES
  -- HCP-2201: visited -17 (AR) and -12 (SK); both genuine, both lift.
  ('STK-501','HCP-2201','SKU-9988',  92, 1590000, date('now','-21 days')),
  ('STK-501','HCP-2201','SKU-9988', 118, 2040000, date('now','-15 days')),
  ('STK-501','HCP-2201','SKU-9988', 154, 2660000, date('now','-8 days')),
  -- HCP-2202: visited -13 by RP; modest lift.
  ('STK-502','HCP-2202','SKU-7721', 198,  311000, date('now','-17 days')),
  ('STK-502','HCP-2202','SKU-7721', 226,  355000, date('now','-9 days')),
  -- HCP-2206: visited -13 by MS, geofence FAILED; sales fall.
  ('STK-502','HCP-2206','SKU-4471',  88,  190000, date('now','-17 days')),
  ('STK-502','HCP-2206','SKU-4471',  61,  132000, date('now','-9 days')),
  -- HCP-2205: visited -16 (SK) and -14 (LW); steady climb.
  ('STK-501','HCP-2205','SKU-5532', 140,   89000, date('now','-20 days')),
  ('STK-501','HCP-2205','SKU-5532', 176,  112000, date('now','-15 days')),
  ('STK-501','HCP-2205','SKU-5532', 205,  131000, date('now','-9 days')),
  -- HCP-2203: visited -14 by KJ; strong lift.
  ('STK-503','HCP-2203','SKU-3345', 104,  191000, date('now','-18 days')),
  ('STK-503','HCP-2203','SKU-3345', 148,  271000, date('now','-10 days')),
  -- HCP-2204: visited -15 by LW, geofence FAILED; sales flat.
  ('STK-504','HCP-2204','SKU-2234',  96,   27000, date('now','-19 days')),
  ('STK-504','HCP-2204','SKU-2234',  94,   26500, date('now','-11 days'));

INSERT OR IGNORE INTO call_recordings (id, visit_id, duration_ms, audio_url, waveform, transcribed_at) VALUES
  ('REC-40021','VIS-40021', 762000, NULL,
   '[0.12,0.34,0.55,0.71,0.42,0.28,0.63,0.81,0.74,0.38,0.22,0.49,0.66,0.85,0.59,0.31,0.18,0.44,0.72,0.68,0.35,0.21,0.53,0.77,0.62,0.29,0.16,0.41,0.58,0.73,0.46,0.25,0.37,0.69,0.83,0.51,0.27,0.19,0.45,0.64]',
   datetime('now','-1 days')),
  ('REC-40023','VIS-40023', 184000, NULL,
   '[0.08,0.15,0.11,0.22,0.31,0.18,0.09,0.13,0.26,0.34,0.19,0.12,0.07,0.16,0.29,0.21,0.14,0.10,0.24,0.33]',
   datetime('now','-2 days')),
  ('REC-40025','VIS-40025', 521000, NULL,
   '[0.22,0.48,0.67,0.55,0.33,0.29,0.71,0.62,0.41,0.26,0.38,0.74,0.59,0.31,0.24,0.52,0.68,0.45,0.30,0.57,0.73,0.39,0.23,0.61,0.66,0.42,0.28,0.50,0.70,0.36]',
   datetime('now','-3 days'));

INSERT OR IGNORE INTO call_snippets (id, recording_id, start_ms, end_ms, label, transcript, severity) VALUES
  (1,'REC-40021',  42000,  71000,'Clinical efficacy discussed','Phase III data on HbA1c reduction was presented with the reprint.','positive'),
  (2,'REC-40021', 188000, 226000,'Dosage concern addressed','Doctor raised titration in renal impairment; rep cited the label section.','positive'),
  (3,'REC-40021', 402000, 448000,'Price objection - unhandled','Doctor noted the generic is 40% cheaper. No value framing offered.','critical'),
  (4,'REC-40021', 690000, 742000,'Follow-up committed','Agreed to a formulary review meeting in three weeks.','positive'),
  (5,'REC-40023',  12000,  38000,'Call abnormally short','Under three minutes; no detailing content detected.','warning'),
  (6,'REC-40023',  96000, 128000,'Background inconsistent with clinic','Ambient audio does not match a clinical setting.','critical'),
  (7,'REC-40025',  61000, 104000,'Competitor loyalty raised','Doctor cited a ten-year relationship with the incumbent brand.','warning'),
  (8,'REC-40025', 300000, 352000,'Safety question answered','Hepatic monitoring schedule explained per label.','positive');

INSERT OR IGNORE INTO hcp_objections (id, visit_id, category, handled, detail) VALUES
  (1,'VIS-40021','price_sensitivity',    0,'Generic priced 40% lower; no value framing offered'),
  (2,'VIS-40021','efficacy_doubt',       1,'Phase III reprint shared'),
  (3,'VIS-40022','competitor_loyalty',   1,'Switched after head-to-head data'),
  (4,'VIS-40024','price_sensitivity',    1,'Patient assistance programme explained'),
  (5,'VIS-40025','competitor_loyalty',   0,'Ten-year incumbent relationship'),
  (6,'VIS-40025','safety_concern',       1,'Hepatic monitoring schedule explained'),
  (7,'VIS-40027','formulary_restriction',0,'Not on the hospital tier-2 list'),
  (8,'VIS-40028','supply_reliability',   1,'Cited 99.2% fill rate over 12 months'),
  (9,'VIS-40026','efficacy_doubt',       0,'No clinical discussion recorded');

INSERT OR IGNORE INTO rep_effectiveness (rep_id, period, dpri, geo_spoof_rate_pct, conversions, detractions) VALUES
  ('AR', strftime('%Y-%m','now'), 118.4,  0.0, 34,  6),
  ('SK', strftime('%Y-%m','now'), 126.9,  1.2, 41,  4),
  ('RP', strftime('%Y-%m','now'),  94.2,  3.8, 12, 19),
  ('MS', strftime('%Y-%m','now'),  88.7, 14.6,  8, 27),
  ('KJ', strftime('%Y-%m','now'), 131.5,  0.4, 47,  3),
  ('LW', strftime('%Y-%m','now'),  91.3, 11.2, 11, 22);

-- ---------------------------------------------------------- market radar --

INSERT OR IGNORE INTO patents (id, molecule, brand, holder, market, exclusivity_type, expiry_date, annual_value_minor, therapeutic_area) VALUES
  ('PAT-001','Insulin Glargine','Lantus','Sanofi','IN','compound',   date('now','+118 days'), 4820000000,'Diabetes'),
  ('PAT-002','Sitagliptin','Januvia','Merck','IN','compound',        date('now','+64 days'),  6110000000,'Diabetes'),
  ('PAT-003','Rivaroxaban','Xarelto','Bayer','EU','compound',        date('now','+402 days'), 9240000000,'Cardiovascular'),
  ('PAT-004','Dapagliflozin','Farxiga','AstraZeneca','IN','formulation', date('now','+221 days'), 3350000000,'Diabetes'),
  ('PAT-005','Apixaban','Eliquis','BMS','US','compound',             date('now','+38 days'), 12800000000,'Cardiovascular'),
  ('PAT-006','Vonoprazan','Voquezna','Takeda','IN','compound',       date('now','+712 days'), 1470000000,'Gastroenterology');

INSERT OR IGNORE INTO formulary_placements (id, network, product, tier, previous_tier, changed_at, region_id) VALUES
  (1,'Apollo Hospitals','Insulin Glargine 100U/ml', 1, 2, datetime('now','-4 days'),'west'),
  (2,'Fortis Healthcare','Atorvastatin 40mg',       3, 2, datetime('now','-9 days'),'north'),
  (3,'Manipal Hospitals','Metformin XR 1000mg',     1, 1, datetime('now','-14 days'),'south'),
  (4,'Max Healthcare','Losartan 50mg',              2, 3, datetime('now','-2 days'),'north'),
  (5,'AMRI Hospitals','Omeprazole 20mg',            4, 2, datetime('now','-6 days'),'east');

INSERT OR IGNORE INTO regulatory_events
  (id, authority, kind, product, ceiling_price_minor, previous_price_minor, detail, effective_from, published_at) VALUES
  (1,'NPPA','ceiling_price','Atorvastatin 40mg',      1580,  1840,'Revised ceiling under DPCO 2013 Schedule I', date('now','+12 days'), datetime('now','-2 days')),
  (2,'NPPA','ceiling_price','Metformin XR 1000mg',     740,   690,'Annual WPI-linked revision',                date('now','+12 days'), datetime('now','-2 days')),
  (3,'CDSCO','approval','Vonoprazan 20mg',            NULL,  NULL,'Marketing authorisation granted to competitor', date('now','-5 days'), datetime('now','-5 days')),
  (4,'FDA','label_change','Insulin Glargine 100U/ml', NULL,  NULL,'Warnings section updated for hypoglycaemia risk', date('now','-11 days'), datetime('now','-11 days')),
  (5,'EMA','approval','Dapagliflozin 10mg',           NULL,  NULL,'Paediatric indication extension approved',   date('now','-18 days'), datetime('now','-18 days')),
  (6,'NPPA','ceiling_price','Azithromycin 500mg',     2260,  2260,'No change at this revision',                date('now','+12 days'), datetime('now','-2 days'));

INSERT OR IGNORE INTO share_of_voice (therapeutic_area, company, period, sov_pct, is_own) VALUES
  ('Diabetes','AnalyzeHive Pharma', strftime('%Y-%m','now'), 27.4, 1),
  ('Diabetes','Sanofi',             strftime('%Y-%m','now'), 31.2, 0),
  ('Diabetes','Novo Nordisk',       strftime('%Y-%m','now'), 24.8, 0),
  ('Diabetes','Merck',              strftime('%Y-%m','now'), 16.6, 0),
  ('Cardiovascular','AnalyzeHive Pharma', strftime('%Y-%m','now'), 19.1, 1),
  ('Cardiovascular','Bayer',        strftime('%Y-%m','now'), 28.7, 0),
  ('Cardiovascular','BMS',          strftime('%Y-%m','now'), 33.4, 0),
  ('Cardiovascular','Cipla',        strftime('%Y-%m','now'), 18.8, 0),
  ('Gastroenterology','AnalyzeHive Pharma', strftime('%Y-%m','now'), 34.6, 1),
  ('Gastroenterology','Takeda',     strftime('%Y-%m','now'), 41.2, 0),
  ('Gastroenterology','Dr Reddys',  strftime('%Y-%m','now'), 24.2, 0);

INSERT OR IGNORE INTO clinical_trials
  (id, sponsor, molecule, therapeutic_area, phase, status, started_at, est_completion, schedule_delta_days, is_own) VALUES
  ('NCT05821440','Sanofi','SAR441255','Diabetes','II','active',      date('now','-310 days'), date('now','+180 days'), -22, 0),
  ('NCT05904118','Novo Nordisk','NN9541','Diabetes','III','recruiting', date('now','-150 days'), date('now','+420 days'),  14, 0),
  ('NCT06012233','AnalyzeHive Pharma','AHP-2201','Diabetes','II','active', date('now','-220 days'), date('now','+240 days'),  -6, 1),
  ('NCT05778901','Bayer','BAY-2413555','Cardiovascular','III','active', date('now','-480 days'), date('now','+95 days'), -41, 0),
  ('NCT06104477','AnalyzeHive Pharma','AHP-3310','Cardiovascular','I','recruiting', date('now','-60 days'), date('now','+300 days'), 8, 1),
  ('NCT05990012','Takeda','TAK-951','Gastroenterology','II','completed', date('now','-700 days'), date('now','-30 days'), -12, 0);

-- -------------------------------------------------------- drug discovery --

INSERT OR IGNORE INTO discovery_programs (id, name, therapeutic_area, target, phase, lead_user_id, started_at, ptrs) VALUES
  ('DP-001','AHP-2201 - GLP-1/GIP co-agonist','Diabetes','GLP1R','II','admin-bootstrap', date('now','-680 days'), 0.42),
  ('DP-002','AHP-3310 - Factor XIa inhibitor','Cardiovascular','F11','I','admin-bootstrap', date('now','-300 days'), 0.28),
  ('DP-003','AHP-4102 - NLRP3 inflammasome','Immunology','NLRP3','discovery','admin-bootstrap-ws', date('now','-140 days'), 0.16),
  ('DP-004','AHP-5008 - PCSK9 oral','Cardiovascular','PCSK9','preclinical','admin-bootstrap', date('now','-410 days'), 0.31);

-- Node/edge geometry for the 3D viewer. Coordinates are model space, roughly
-- centred on the origin; the renderer scales to fit rather than assuming units.
INSERT OR IGNORE INTO disease_models (id, program_id, name, disease, model_type, summary, nodes, edges) VALUES
  ('DM-001','DP-001','Incretin signalling axis','Type 2 Diabetes','pathway',
   'GLP-1 and GIP receptor signalling through cAMP/PKA to insulin exocytosis. The co-agonist acts at both receptors; the model highlights the shared downstream node where selectivity is lost.',
   '[{"id":"GLP1R","label":"GLP1R","kind":"receptor","x":-2.6,"y":1.4,"z":0.2,"radius":0.52,"expression":0.91},
     {"id":"GIPR","label":"GIPR","kind":"receptor","x":-2.4,"y":-1.5,"z":-0.4,"radius":0.48,"expression":0.77},
     {"id":"GNAS","label":"Gs alpha","kind":"transducer","x":-0.9,"y":0.1,"z":0.6,"radius":0.40,"expression":0.68},
     {"id":"ADCY","label":"Adenylate cyclase","kind":"enzyme","x":0.4,"y":0.9,"z":-0.3,"radius":0.44,"expression":0.72},
     {"id":"CAMP","label":"cAMP","kind":"metabolite","x":1.5,"y":0.2,"z":0.8,"radius":0.30,"expression":0.85},
     {"id":"PKA","label":"PKA","kind":"kinase","x":2.6,"y":1.1,"z":0.1,"radius":0.46,"expression":0.80},
     {"id":"EPAC2","label":"EPAC2","kind":"kinase","x":2.4,"y":-1.2,"z":0.5,"radius":0.38,"expression":0.54},
     {"id":"INS","label":"Insulin exocytosis","kind":"output","x":4.1,"y":0.0,"z":-0.2,"radius":0.60,"expression":0.94},
     {"id":"DPP4","label":"DPP-4","kind":"enzyme","x":-4.0,"y":0.0,"z":1.1,"radius":0.36,"expression":0.61}]',
   '[{"source":"DPP4","target":"GLP1R","kind":"inhibits","weight":0.7},
     {"source":"GLP1R","target":"GNAS","kind":"activates","weight":0.9},
     {"source":"GIPR","target":"GNAS","kind":"activates","weight":0.75},
     {"source":"GNAS","target":"ADCY","kind":"activates","weight":0.88},
     {"source":"ADCY","target":"CAMP","kind":"produces","weight":0.95},
     {"source":"CAMP","target":"PKA","kind":"activates","weight":0.9},
     {"source":"CAMP","target":"EPAC2","kind":"activates","weight":0.6},
     {"source":"PKA","target":"INS","kind":"activates","weight":0.85},
     {"source":"EPAC2","target":"INS","kind":"activates","weight":0.55}]'),
  ('DM-002','DP-002','Contact activation cascade','Thrombosis','pathway',
   'Factor XIa sits at the junction of contact activation and thrombin amplification. Inhibiting it is intended to decouple thrombosis from haemostasis.',
   '[{"id":"FXII","label":"Factor XII","kind":"zymogen","x":-3.2,"y":1.0,"z":0.0,"radius":0.44,"expression":0.66},
     {"id":"FXI","label":"Factor XI","kind":"zymogen","x":-1.4,"y":0.4,"z":0.7,"radius":0.50,"expression":0.83},
     {"id":"FXIa","label":"Factor XIa","kind":"enzyme","x":0.2,"y":1.2,"z":-0.5,"radius":0.58,"expression":0.95},
     {"id":"FIX","label":"Factor IX","kind":"zymogen","x":1.7,"y":-0.6,"z":0.3,"radius":0.42,"expression":0.71},
     {"id":"FX","label":"Factor X","kind":"zymogen","x":3.0,"y":0.7,"z":0.9,"radius":0.44,"expression":0.74},
     {"id":"THR","label":"Thrombin","kind":"enzyme","x":4.4,"y":-0.2,"z":-0.3,"radius":0.56,"expression":0.89},
     {"id":"FIB","label":"Fibrin clot","kind":"output","x":5.8,"y":0.5,"z":0.2,"radius":0.62,"expression":0.92}]',
   '[{"source":"FXII","target":"FXI","kind":"activates","weight":0.7},
     {"source":"FXI","target":"FXIa","kind":"activates","weight":0.9},
     {"source":"FXIa","target":"FIX","kind":"activates","weight":0.85},
     {"source":"FIX","target":"FX","kind":"activates","weight":0.8},
     {"source":"FX","target":"THR","kind":"activates","weight":0.88},
     {"source":"THR","target":"FIB","kind":"produces","weight":0.95},
     {"source":"THR","target":"FXI","kind":"activates","weight":0.5}]'),
  ('DM-003','DP-003','NLRP3 inflammasome assembly','Chronic Inflammation','protein',
   'Priming and assembly steps for the NLRP3 inflammasome. The programme targets the NACHT domain to block oligomerisation before ASC speck formation.',
   '[{"id":"TLR4","label":"TLR4","kind":"receptor","x":-3.0,"y":1.8,"z":0.4,"radius":0.50,"expression":0.79},
     {"id":"NFKB","label":"NF-kB","kind":"transducer","x":-1.5,"y":0.6,"z":-0.6,"radius":0.46,"expression":0.84},
     {"id":"NLRP3","label":"NLRP3","kind":"sensor","x":0.3,"y":1.5,"z":0.5,"radius":0.64,"expression":0.97},
     {"id":"ASC","label":"ASC speck","kind":"adaptor","x":1.9,"y":0.2,"z":-0.4,"radius":0.52,"expression":0.81},
     {"id":"CASP1","label":"Caspase-1","kind":"enzyme","x":3.3,"y":1.0,"z":0.7,"radius":0.48,"expression":0.76},
     {"id":"IL1B","label":"IL-1 beta","kind":"output","x":4.8,"y":-0.3,"z":0.0,"radius":0.58,"expression":0.90},
     {"id":"GSDMD","label":"Gasdermin D","kind":"output","x":4.5,"y":1.9,"z":-0.8,"radius":0.44,"expression":0.63}]',
   '[{"source":"TLR4","target":"NFKB","kind":"activates","weight":0.85},
     {"source":"NFKB","target":"NLRP3","kind":"primes","weight":0.9},
     {"source":"NLRP3","target":"ASC","kind":"recruits","weight":0.92},
     {"source":"ASC","target":"CASP1","kind":"activates","weight":0.88},
     {"source":"CASP1","target":"IL1B","kind":"produces","weight":0.94},
     {"source":"CASP1","target":"GSDMD","kind":"cleaves","weight":0.7}]');

INSERT OR IGNORE INTO compound_candidates
  (id, program_id, code_name, binding_affinity_nm, selectivity_fold, admet_score, status) VALUES
  ('CC-1001','DP-001','AHP-2201-A',   2.4, 180,  78.5,'lead'),
  ('CC-1002','DP-001','AHP-2201-B',   0.9, 340,  84.1,'optimised'),
  ('CC-1003','DP-001','AHP-2201-C',  14.7,  62,  59.3,'dropped'),
  ('CC-1004','DP-002','AHP-3310-A',   5.1, 220,  71.8,'lead'),
  ('CC-1005','DP-002','AHP-3310-D',   3.3, 410,  80.6,'optimised'),
  ('CC-1006','DP-003','AHP-4102-A',  38.2,  45,  52.4,'hit'),
  ('CC-1007','DP-003','AHP-4102-F',  19.6,  88,  64.9,'hit'),
  ('CC-1008','DP-004','AHP-5008-B',   7.8, 155,  73.2,'lead');

-- ------------------------------------------------- system status extras ---

-- Enterprise pharma runs on purchase orders, credit memos and SAP invoicing.
-- A retail payment gateway was never part of this estate.
UPDATE services SET name = 'SAP/ERP Connector Pipeline' WHERE name = 'Payment Gateway';
UPDATE services SET name = '21 CFR Part 11 Audit Trail Engine' WHERE name = 'Reporting API';
UPDATE services SET name = 'HL7/FHIR Ingestion Engine'  WHERE name = 'Data Ingestion Pipeline';
UPDATE services SET name = 'Triton Inference Cluster'   WHERE name = 'AI Inference Cluster';

INSERT OR IGNORE INTO services (name, region, status, uptime_pct) VALUES
  ('Cold Chain Telemetry Bus', 'APAC', 'Operational', 99.94),
  ('Distributor EDI Gateway',  'Global','Degraded',   98.71);

INSERT OR IGNORE INTO inference_metrics (id, model, p50_ms, p95_ms, queue_depth, gpu_util_pct, recorded_at) VALUES
  (1,'bionemo-esm2-650m',   41.2,  88.6, 3, 71.4, datetime('now')),
  (2,'logistics-gnn-v3',    12.8,  27.1, 0, 38.9, datetime('now')),
  (3,'callaudit-whisper-lg',312.5, 704.0,7, 84.2, datetime('now')),
  (4,'arrhenius-surrogate',  6.4,  14.9, 0, 12.6, datetime('now'));

INSERT OR IGNORE INTO ingestion_throughput (id, source, records_per_sec, backlog_records, recorded_at) VALUES
  (1,'Distributor EDI', 1840.5, 412000, datetime('now')),
  (2,'CSV Upload',       320.2,      0, datetime('now')),
  (3,'SAP IDoc Stream', 2610.8,  18400, datetime('now')),
  (4,'LIMS Results',      88.4,      0, datetime('now'));
