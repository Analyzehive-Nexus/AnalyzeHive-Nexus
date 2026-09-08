#!/usr/bin/env python3
"""
Synthetic dataset generator for AnalyzeHive Nexus.

Rules this generator holds to:
  * `users` is never touched - it is the auth allowlist.
  * `sessions` / `oauth_states` are never populated: a session row is a live
    credential and OAuth state is single-use transient data. Synthetic rows
    there are junk at best.
  * Existing rows survive. Generated surrogate keys start at OFFSET so they
    cannot collide, and every statement is INSERT OR IGNORE.
  * The four seeded regions and warehouses (wh-north, wh-west, ...) are kept:
    the simulator and region filter reference them by id.
  * Money is INTEGER minor units (paise). Timestamps are 'YYYY-MM-DD HH:MM:SS'.
"""
import json, os, random, sys
from datetime import datetime, timedelta

random.seed(20260908)          # deterministic: re-running yields the same set
OUT = sys.argv[1]
OFFSET = 100_000               # surrogate keys start here; existing max is <1k
NOW = datetime(2026, 9, 8, 6, 0, 0)

def ts(days_ago=0.0):
    return (NOW - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
def dt(days_ago=0.0):
    return (NOW - timedelta(days=days_ago)).strftime("%Y-%m-%d")
def q(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"
def n(v):
    return "NULL" if v is None else str(v)

# ---------------------------------------------------------------- writer ---
class Writer:
    """Buffers INSERTs and flushes ~1.2MB SQL files, so each HTTP request to
    D1 stays a sane size."""
    # D1 rejects a /query payload somewhere past ~1.25MB with SQLITE_TOOBIG
    # ("statement too long"), and the buffer can overshoot by one statement
    # because it flushes after appending. Both bounds are set so the worst
    # case file is LIMIT + STMT_BYTES = 750KB, comfortably inside.
    LIMIT = 600_000
    # SQLite caps a single statement at 1MB (SQLITE_MAX_SQL_LENGTH) and D1
    # enforces it, so statements are split on BYTES, not row count - a table
    # with JSON columns blows past 1MB long before a fixed row count would.
    # Measured against D1, not guessed: a 52KB INSERT succeeds and a 105KB one
    # returns SQLITE_TOOBIG, so the practical per-statement ceiling sits between
    # them. 45KB leaves margin. The payload ceiling is separately ~1.25MB.
    STMT_BYTES = 45_000
    ROWS_PER_STMT = 250
    def __init__(self, outdir):
        self.outdir, self.buf, self.size, self.part = outdir, [], 0, 0
        self.counts = {}
    def table(self, name, cols, rows):
        if not rows: return
        self.counts[name] = self.counts.get(name, 0) + len(rows)
        head = f"INSERT OR IGNORE INTO {name} ({', '.join(cols)}) VALUES\n"
        cur, cur_bytes = [], 0
        def emit():
            nonlocal cur, cur_bytes
            if not cur: return
            stmt = head + ",\n".join(cur) + ";\n"
            self.buf.append(stmt); self.size += len(stmt)
            cur, cur_bytes = [], 0
            if self.size >= self.LIMIT: self.flush()
        for r in rows:
            tup = "  (" + ", ".join(r) + ")"
            if cur and (cur_bytes + len(tup) > self.STMT_BYTES or len(cur) >= self.ROWS_PER_STMT):
                emit()
            cur.append(tup); cur_bytes += len(tup) + 2
        emit()
    def flush(self):
        if not self.buf: return
        self.part += 1
        with open(os.path.join(self.outdir, f"{self.part:03d}.sql"), "w") as f:
            f.write("".join(self.buf))
        self.buf, self.size = [], 0

W = Writer(OUT)

# ------------------------------------------------------------ vocabulary ---
MOLECULES = ["Insulin Glargine","Atorvastatin","Metformin XR","Omeprazole","Losartan",
 "Azithromycin","Pantoprazole","Amlodipine","Rosuvastatin","Telmisartan","Sitagliptin",
 "Dapagliflozin","Empagliflozin","Clopidogrel","Rivaroxaban","Apixaban","Levothyroxine",
 "Montelukast","Salbutamol","Budesonide","Amoxicillin","Cefixime","Levofloxacin",
 "Doxycycline","Paracetamol","Ibuprofen","Diclofenac","Tramadol","Gabapentin",
 "Pregabalin","Sertraline","Escitalopram","Olanzapine","Risperidone","Vonoprazan",
 "Rabeprazole","Esomeprazole","Glimepiride","Vildagliptin","Linagliptin","Hydrochlorothiazide",
 "Ramipril","Enalapril","Metoprolol","Bisoprolol","Carvedilol","Furosemide","Spironolactone",
 "Warfarin","Heparin","Enoxaparin","Tenecteplase","Insulin Aspart","Insulin Lispro",
 "Semaglutide","Liraglutide","Dulaglutide","Teriparatide","Denosumab","Adalimumab"]
FORMS = ["10mg","20mg","25mg","40mg","50mg","75mg","100mg","250mg","500mg","1000mg",
 "100U/ml","5mg/ml","2.5mg","1.25mg","XR 500mg","SR 100mg","DR 40mg"]
TA = ["Diabetes","Cardiovascular","Gastroenterology","Respiratory","Oncology",
 "Immunology","Neurology","Psychiatry","Infectious Disease","Endocrinology",
 "Nephrology","Dermatology","Rheumatology","Ophthalmology","Haematology",
 "Urology","Paediatrics","Womens Health","Pain Management","Vaccines"]
COMPANIES = ["Sanofi","Novo Nordisk","Merck","Bayer","BMS","AstraZeneca","Takeda",
 "Pfizer","Novartis","Roche","GSK","Eli Lilly","Boehringer","Abbott","Cipla",
 "Sun Pharma","Dr Reddys","Lupin","Zydus","Torrent","Glenmark","Alkem","Mankind",
 "Intas","Aurobindo"]
OWN = "AnalyzeHive Pharma"
CITIES = [("Mumbai",19.076,72.8777),("Delhi",28.6139,77.209),("Bengaluru",12.9716,77.5946),
 ("Chennai",13.0827,80.2707),("Kolkata",22.5726,88.3639),("Hyderabad",17.385,78.4867),
 ("Pune",18.5204,73.8567),("Ahmedabad",23.0225,72.5714),("Jaipur",26.9124,75.7873),
 ("Lucknow",26.8467,80.9462),("Chandigarh",30.7333,76.7794),("Kochi",9.9312,76.2673),
 ("Indore",22.7196,75.8577),("Nagpur",21.1458,79.0882),("Bhopal",23.2599,77.4126),
 ("Patna",25.5941,85.1376),("Guwahati",26.1445,91.7362),("Surat",21.1702,72.8311),
 ("Ludhiana",30.901,75.8573),("Coimbatore",11.0168,76.9558),("Visakhapatnam",17.6868,83.2185),
 ("Bhubaneswar",20.2961,85.8245),("Raipur",21.2514,81.6296),("Dehradun",30.3165,78.0322)]
FIRST = ["Ananya","Rakesh","Sunita","Vivek","Priya","Imran","Kavita","Arjun","Meera",
 "Sanjay","Deepa","Rohit","Neha","Amit","Divya","Karan","Pooja","Vikram","Anjali",
 "Suresh","Rhea","Nikhil","Shreya","Manoj","Ishita","Aditya","Farah","Gaurav",
 "Lakshmi","Tarun","Naveen","Sneha","Rajesh","Aisha","Varun","Kiran","Sameer","Nandini"]
LAST = ["Iyer","Menon","Bhatt","Raman","Deshmukh","Qureshi","Sharma","Patel","Reddy",
 "Kumar","Singh","Johnson","Wei","Nair","Gupta","Verma","Rao","Chatterjee","Bose",
 "Kulkarni","Joshi","Mehta","Shah","Das","Pillai","Banerjee","Malhotra","Kapoor"]
SPECIALTY = ["Endocrinology","Cardiology","Gastroenterology","General Medicine",
 "Nephrology","Pulmonology","Neurology","Psychiatry","Oncology","Paediatrics",
 "Orthopaedics","Dermatology","Rheumatology","Urology","Gynaecology"]
COLORS = ["bg-indigo-500","bg-blue-500","bg-emerald-500","bg-purple-500","bg-orange-500",
 "bg-pink-500","bg-teal-500","bg-cyan-500","bg-rose-500","bg-amber-500","bg-lime-500","bg-violet-500"]
print("vocabulary ready", file=sys.stderr)

# ===================================================== reference / config ===
# These stay bounded by reality rather than padded to 1000: they are option
# lists and permission sets, and inflating them would only break the UI that
# renders them as menus.

EXISTING_REGIONS = ["north", "south", "east", "west"]
NEW_REGIONS = [("northeast","North East"),("central","Central"),("northwest","North West"),
 ("southwest","South West"),("southeast","South East"),("mena","MENA"),
 ("apac","APAC"),("emea","EMEA")]
W.table("regions", ["id","name"], [[q(i), q(nm)] for i, nm in NEW_REGIONS])
REGIONS = EXISTING_REGIONS + [i for i, _ in NEW_REGIONS]

CUR = [("AED","د.إ","UAE Dirham","ar-AE",0.0496),("AUD","A$","Australian Dollar","en-AU",0.0170),
 ("BDT","৳","Bangladeshi Taka","bn-BD",1.3480),("BRL","R$","Brazilian Real","pt-BR",0.0612),
 ("CAD","C$","Canadian Dollar","en-CA",0.0153),("CHF","Fr","Swiss Franc","de-CH",0.0090),
 ("CNY","¥","Chinese Yuan","zh-CN",0.0802),("EGP","E£","Egyptian Pound","ar-EG",0.5460),
 ("IDR","Rp","Indonesian Rupiah","id-ID",183.42),("JPY","¥","Japanese Yen","ja-JP",1.6800),
 ("KES","KSh","Kenyan Shilling","en-KE",1.4550),("LKR","Rs","Sri Lankan Rupee","si-LK",3.4100),
 ("MXN","$","Mexican Peso","es-MX",0.2110),("NGN","₦","Nigerian Naira","en-NG",17.240),
 ("SAR","﷼","Saudi Riyal","ar-SA",0.0422),("SGD","S$","Singapore Dollar","en-SG",0.0145),
 ("THB","฿","Thai Baht","th-TH",0.3640),("TRY","₺","Turkish Lira","tr-TR",0.4590),
 ("VND","₫","Vietnamese Dong","vi-VN",295.10),("ZAR","R","South African Rand","en-ZA",0.2030)]
W.table("currencies", ["code","symbol","name","minor_units","locale"],
        [[q(c),q(s),q(nm),"100",q(l)] for c,s,nm,l,_ in CUR])
W.table("fx_rates", ["code","rate_from_inr","as_of"],
        [[q(c), f"{r:.5f}", q(ts(0))] for c,_,_,_,r in CUR])

DEPTS = ["Supply Chain","Quality & Compliance","Commercial","R&D","Logistics",
 "Regulatory Affairs","Medical Affairs","Manufacturing","Finance","Market Access"]
TITLES = ["Head of","Director,","Senior Manager,","Manager,","Lead,","Analyst,","Associate,","VP,"]
AREAS = ["Global Supply","Cold Chain","Field Force","Pharmacovigilance","Quality Assurance",
 "Regulatory Strategy","Trade Compliance","Demand Planning","Distribution","Clinical Operations",
 "Serialisation","Batch Release","Vendor Qualification","Artwork & Labelling","Stability Programme",
 "Tender Management","Key Accounts","Hospital Sales","Retail Sales","Medical Information",
 "Health Economics","Market Access","Patient Support","Digital Health","Data Governance",
 "Warehouse Operations","Transport Planning","Customs & Trade","Contract Manufacturing","Packaging"]
REGIONS_SUFFIX = ["", " - North", " - South", " - East", " - West", " - APAC", " - EMEA"]
desig, seen = [], set()
for t in TITLES:
    for a in AREAS:
        for suf in REGIONS_SUFFIX:
            did = (t + a + suf).lower().replace(",", "").replace("&", "and").replace(" ", "-").replace("--", "-")[:60]
            if did in seen: continue
            seen.add(did)
            desig.append([q(did), q(f"{t} {a}{suf}"), q(random.choice(DEPTS)), str(random.randint(2, 9))])
W.table("designations", ["id","title","department","grade"], desig)

PERM_DOMAINS = ["supply","commercial","discovery","audit","quality","logistics","market",
 "admin","finance","regulatory","coldchain","serialisation","formulary","pricing","trials",
 "warehouse","transport","vendor","labelling","pharmacovigilance"]
PERM_ACTIONS = ["view","export","approve","create","update","delete","sign","simulate","assign","escalate"]
PERM_SCOPES = ["self","team","region","global","global.restricted"]
perms, rperms = [], []
for d in PERM_DOMAINS:
    for a in PERM_ACTIONS:
        for sc in PERM_SCOPES:
            pid = f"{d}.{a}.{sc}"
            sig = 1 if a in ("approve","sign","delete","export") else 0
            perms.append([q(pid), q(f"{a.capitalize()} {d} records at {sc} scope"), str(sig)])
            rperms.append([q("admin"), q(pid)])
            if a in ("view","simulate","create","update"): rperms.append([q("manager"), q(pid)])
            if a == "view": rperms.append([q("employee"), q(pid)])
W.table("permissions", ["id","description","requires_signature"], perms)
W.table("role_permissions", ["role","permission_id"], rperms)

# ==================================================== dimensions ===========
SKUS = []
for i in range(1500):
    sku = f"SKU-{20000 + i}"
    SKUS.append(sku)
W.table("skus", ["sku","name"],
        [[q(s), q(f"{random.choice(MOLECULES)} {random.choice(FORMS)}")] for s in SKUS])

# Existing four warehouses stay; the simulator addresses wh-north / wh-west by id.
EXISTING_WH = ["wh-north","wh-west","wh-south","wh-east"]
WAREHOUSES = list(EXISTING_WH)
wh_rows = []
for i in range(1000):
    wid = f"wh-{1000 + i}"
    city, lat, lng = random.choice(CITIES)
    WAREHOUSES.append(wid)
    wh_rows.append([q(wid), q(f"DC {i + 1:04d} - {city}"), q(random.choice(REGIONS)),
                    f"{lat + random.uniform(-0.4, 0.4):.4f}", f"{lng + random.uniform(-0.4, 0.4):.4f}",
                    str(random.choice([0, 1, 1])), str(random.randrange(8000, 90000, 500))])
W.table("warehouses", ["id","name","region_id","lat","lng","cold_chain","capacity_units"], wh_rows)

# Field force, built as a real tree: zone -> regional -> area -> city leads.
EXISTING_REPS = ["AR","SK","RP","MS","KJ","LW"]
REPS, rep_rows = list(EXISTING_REPS), []
tiers = [("Zone Manager", 40, None), ("Regional Lead", 120, 0),
         ("Area Manager", 340, 1), ("City Lead", 700, 2)]
tier_ids = []
for ti, (title, count, parent_tier) in enumerate(tiers):
    ids = []
    for i in range(count):
        rid = f"FR{ti}{i:04d}"
        fn, ln = random.choice(FIRST), random.choice(LAST)
        mgr = random.choice(tier_ids[parent_tier]) if parent_tier is not None and tier_ids[parent_tier] else None
        ids.append(rid); REPS.append(rid)
        rep_rows.append([q(rid), q(f"{fn} {ln}"), q(title), q((fn[0] + ln[0]).upper()),
                         q(random.choice(COLORS)), str(random.randint(0, 45)),
                         q(random.choice(REGIONS)), q(mgr) if mgr else "NULL", "NULL"])
    tier_ids.append(ids)
W.table("field_reps", ["id","name","title","initials","color","team_size","region_id","manager_id","user_id"], rep_rows)

HCPS, hcp_rows = [], []
for i in range(3000):
    hid = f"HCP-{10000 + i}"
    city, lat, lng = random.choice(CITIES)
    fn, ln = random.choice(FIRST), random.choice(LAST)
    HCPS.append(hid)
    hcp_rows.append([q(hid), q(f"Dr. {fn} {ln}"), q(random.choice(SPECIALTY)),
                     q(f"{ln} {random.choice(['Clinic','Hospital','Medical Centre','Polyclinic','Institute'])}"),
                     f"{lat + random.uniform(-0.3,0.3):.4f}", f"{lng + random.uniform(-0.3,0.3):.4f}",
                     str(random.choice([100,120,150,180,200,250])), q(random.choice(REGIONS))])
W.table("hcps", ["id","name","specialty","clinic_name","clinic_lat","clinic_lng","geofence_radius_m","region_id"], hcp_rows)

STOCKISTS, st_rows = [], []
for i in range(1000):
    sid = f"STK-{2000 + i}"
    city, lat, lng = random.choice(CITIES)
    STOCKISTS.append(sid)
    st_rows.append([q(sid), q(f"{random.choice(['Meridian','Northgate','Bengal','Deccan','Apex','Prime','Unity','Sterling','Crescent','Vertex'])} {random.choice(['Pharma Distributors','Medical Supplies','Health Traders','Drug House','Healthcare'])} {i+1}"),
                    q(random.choice(REGIONS)), f"{lat:.4f}", f"{lng:.4f}"])
W.table("stockists", ["id","name","region_id","lat","lng"], st_rows)

links = set()
for _ in range(6000):
    links.add((random.choice(STOCKISTS), random.choice(HCPS)))
W.table("stockist_hcp_links", ["stockist_id","hcp_id"], [[q(a), q(b)] for a, b in links])
print("dimensions done", file=sys.stderr)

# ==================================================== inventory & alerts ===
ADMINS = ["admin-bootstrap", "admin-bootstrap-ws"]

BATCH_IDS, batch_rows = [], []
for i in range(20000):
    bid = OFFSET + i
    days = random.randint(-60, 900)               # negative = already expired
    status = "Critical" if days < 90 else "Warning" if days < 180 else "Good"
    qty = random.randrange(100, 9000, 50)
    BATCH_IDS.append(bid)
    batch_rows.append([str(bid), q(f"P-{500000 + i}"), q(random.choice(SKUS)),
                       q(random.choice(REGIONS)), str(qty),
                       str(qty * random.randrange(400, 9000)),
                       q(dt(-days)), q(status), q(ts(random.uniform(0, 700))),
                       q(random.choice(WAREHOUSES)), str(random.randrange(100, 2500, 50))])
W.table("inventory_batches", ["id","batch_code","sku","region_id","quantity","value_minor",
        "expiry_date","status","created_at","warehouse_id","safety_stock_units"], batch_rows)

ALERT_TITLES = ["Temperature excursion detected","Batch approaching expiry","Stock below reorder point",
 "Cold chain breach in transit","Distributor return spike","Counterfeit report filed",
 "Recall notice issued","Shipment delayed at customs","Logger battery critical",
 "Unverified field visit","Formulary tier demotion","Ceiling price revision applied",
 "Stability excursion recorded","Serialisation mismatch","Quarantine hold placed"]
alert_rows = []
for i in range(5000):
    lvl = random.choices(["critical","warning","info"], [0.2, 0.45, 0.35])[0]
    created = random.uniform(0, 400)
    resolved = q(ts(created - random.uniform(0.1, 20))) if random.random() < 0.6 else "NULL"
    alert_rows.append([str(OFFSET + i), q(lvl), q(random.choice(ALERT_TITLES)),
                       q(f"Detected on batch P-{500000 + random.randrange(20000)} during routine monitoring."),
                       q("Root-cause analysis attached. Owner notified via the escalation matrix."),
                       str(random.choice(BATCH_IDS)), q(random.choice(REGIONS)),
                       q(ts(created)), resolved])
W.table("alerts", ["id","level","title","description","detail","batch_id","region_id","created_at","resolved_at"], alert_rows)

notif_rows, nread_rows = [], []
for i in range(3000):
    nid = OFFSET + i
    notif_rows.append([str(nid), q(random.choice(ALERT_TITLES)),
                       q("Review the affected records and acknowledge in the operations queue."),
                       q(random.choice(REGIONS)) if random.random() < 0.7 else "NULL",
                       q(ts(random.uniform(0, 300)))])
    for u in ADMINS:
        if random.random() < 0.5:
            nread_rows.append([str(nid), q(u), q(ts(random.uniform(0, 300)))])
W.table("notifications", ["id","title","message","region_id","created_at"], notif_rows)
W.table("notification_reads", ["notification_id","user_id","read_at"], nread_rows)

ACTIONS = ["Signed in with Google","Approved a stock transfer","Exported the audit trail",
 "Flagged a representative","Released a batch","Ran a redistribution simulation",
 "Updated a formulary record","Acknowledged a cold chain alert","Uploaded a dataset",
 "Revoked a signature credential","Viewed the Part 11 audit trail","Raised a Stock Transport Order"]
W.table("activity_log", ["id","user_id","action","kind","occurred_at"],
    [[str(OFFSET + i), q(random.choice(ADMINS)), q(random.choice(ACTIONS)),
      q(random.choices(["success","info","warning","error"], [0.5,0.3,0.15,0.05])[0]),
      q(ts(random.uniform(0, 500)))] for i in range(15000)])

# ==================================================== market signals ========
SOURCES = ["PubMed","Twitter/X","Reuters Health","LinkedIn","Clinical Trials Registry",
 "NPPA Bulletin","CDSCO Circular","FDA Newsroom","EMA Press","Company Filing",
 "Distributor Feedback","Conference Abstract","Patent Office Gazette","Pharma Times"]
sig_rows = []
for i in range(8000):
    mol = random.choice(MOLECULES)
    sig_rows.append([str(OFFSET + i), q(random.choice(SOURCES)),
        q(f"{mol}: {random.choice(['new head-to-head data','supply disruption reported','pricing pressure in tier-2','formulary win at a hospital network','generic entrant filed','label expansion submitted','safety signal under review','prescriber sentiment shifting'])}"),
        q(random.choices(["positive","neutral","critical"], [0.35,0.4,0.25])[0]),
        q(random.choice(["Low","Medium","High","Critical"])),
        q(random.choice(REGIONS)), q(ts(random.uniform(0, 200)))])
W.table("market_signals", ["id","source","title","sentiment","impact","region_id","detected_at"], sig_rows)

NODE_IDS, node_rows = [], []
for i in range(1000):
    nid = f"ND-{1000 + i}"
    NODE_IDS.append(nid)
    node_rows.append([q(nid), q(random.choice(COMPANIES) + f" {random.choice(['India','APAC','EMEA','Global','Retail','Institutional'])}"),
                      q(random.choice(["internal","competitor","market","supplier"])),
                      q(random.choice(["safe","warning","critical","neutral"]))])
W.table("network_nodes", ["id","name","kind","status"], node_rows)

ANA_IDS, ana_rows, act_rows = [], [], []
for i in range(1200):
    aid = OFFSET + i
    ANA_IDS.append(aid)
    ana_rows.append([str(aid), q(random.choice(NODE_IDS)),
        q("Share of voice moved against us in two therapeutic areas this quarter."),
        q("Reallocate detailing effort toward the affected specialties and refresh the value dossier."),
        q(ts(random.uniform(0, 250)))])
    for o in range(random.randint(2, 5)):
        act_rows.append([str(aid), str(o),
            q(random.choice(["Campaign launched in metro clusters","Pricing revised downward",
              "New indication filed","Distributor agreement renewed","Sales force expanded",
              "Patent litigation filed","KOL advisory board convened"]))])
W.table("node_analyses", ["id","node_id","summary","recommendation","generated_at"], ana_rows)
W.table("node_analysis_activity", ["analysis_id","ordinal","activity"], act_rows)
print("inventory/market done", file=sys.stderr)

# ==================================================== field force ==========
PERIODS = [(NOW - timedelta(days=30 * k)).strftime("%Y-%m") for k in range(12)]

rm_rows, eff_rows, ae_rows = [], [], []
for rid in REPS:
    for p in PERIODS:
        rep = random.randint(40, 140)
        ver = max(0, rep - random.randint(0, 45))
        ratio = ver / rep if rep else 1
        rm_rows.append([q(rid), q(p), str(rep), str(ver),
                        q("Verified" if ratio > 0.85 else "Flagged" if ratio < 0.7 else "Pending")])
        eff_rows.append([q(rid), q(p), f"{random.uniform(78, 140):.1f}",
                         f"{random.choice([0,0,0.4,1.2,3.8,7.5,11.2,14.6]):.1f}",
                         str(random.randint(3, 55)), str(random.randint(1, 30))])
W.table("rep_metrics", ["rep_id","period","reported","verified","status"], rm_rows)
W.table("rep_effectiveness", ["rep_id","period","dpri","geo_spoof_rate_pct","conversions","detractions"], eff_rows)

EVENTS = ["Call logged without GPS lock","Sample accountability reconciled","Expense claim flagged",
 "Territory reassignment approved","Duplicate visit entry removed","Training module completed",
 "Customer complaint escalated","Detailing aid downloaded","Route plan deviated",
 "Signature captured on delivery","Stock return processed","Coaching session recorded"]
for i in range(30000):
    ae_rows.append([str(OFFSET + i), q(random.choice(REPS)), q(random.choice(EVENTS)),
                    str(1 if random.random() < 0.18 else 0), q(ts(random.uniform(0, 400)))])
W.table("audit_events", ["id","rep_id","event","flagged","occurred_at"], ae_rows)

# Visits carry the geofence verdict; sales are seeded on both sides of each
# visit so the triangulation windows are never empty.
VISIT_IDS, visit_rows, sale_rows = [], [], []
for i in range(40000):
    vid = f"VIS-{100000 + i}"
    rid, hid = random.choice(REPS), random.choice(HCPS)
    verified = random.random() > 0.16
    dist = random.randint(5, 190) if verified else random.randint(600, 9000)
    when = random.uniform(8, 380)
    VISIT_IDS.append((vid, hid, when))
    visit_rows.append([q(vid), q(rid), q(hid), q(ts(when)),
        f"{random.uniform(8.0, 32.0):.4f}", f"{random.uniform(68.0, 92.0):.4f}",
        str(dist), str(1 if verified else 0),
        f"{random.uniform(0.01, 0.14) if verified else random.uniform(0.6, 0.98):.2f}",
        q(random.choice(REGIONS))])
W.table("hcp_visits", ["id","rep_id","hcp_id","visited_at","ping_lat","ping_lng",
        "distance_m","geo_verified","spoof_score","region_id"], visit_rows)

for i in range(50000):
    vid, hid, when = random.choice(VISIT_IDS)
    # Half land in the "before" window, half in the "after" window.
    offset = random.uniform(1, 6) * (1 if random.random() < 0.5 else -1)
    units = random.randint(20, 400)
    sale_rows.append([q(random.choice(STOCKISTS)), q(hid), q(random.choice(SKUS)),
                      str(units), str(units * random.randrange(300, 20000)),
                      q(dt(when + offset))])
W.table("stockist_sales", ["stockist_id","hcp_id","sku","units","value_minor","sold_on"], sale_rows)

# Call recordings: waveform is a precomputed envelope, kept short on purpose -
# it is a preview, not the audio.
REC_IDS, rec_rows, snip_rows = [], [], []
LABELS = [("Clinical efficacy discussed","positive"),("Dosage concern addressed","positive"),
 ("Price objection - unhandled","critical"),("Follow-up committed","positive"),
 ("Competitor loyalty raised","warning"),("Safety question answered","positive"),
 ("Call abnormally short","warning"),("Background inconsistent with clinic","critical"),
 ("Formulary access discussed","info"),("Sample request logged","info")]
for i in range(20000):
    rid_ = f"REC-{100000 + i}"
    vid, _, when = VISIT_IDS[i % len(VISIT_IDS)]
    dur = random.randrange(90000, 1500000, 1000)
    wave = json.dumps([round(random.uniform(0.05, 0.95), 2) for _ in range(32)])
    REC_IDS.append((rid_, dur))
    rec_rows.append([q(rid_), q(vid), str(dur), "NULL", q(wave), q(ts(when))])
W.table("call_recordings", ["id","visit_id","duration_ms","audio_url","waveform","transcribed_at"], rec_rows)

sid_seq = OFFSET
for rid_, dur in REC_IDS:
    for _ in range(random.randint(1, 3)):
        start = random.randrange(0, max(dur - 40000, 1000))
        end = min(start + random.randrange(15000, 60000), dur)
        if end <= start: continue
        lab, sev = random.choice(LABELS)
        snip_rows.append([str(sid_seq), q(rid_), str(start), str(end), q(lab),
                          q("Transcribed segment flagged by the call-audit model."), q(sev)])
        sid_seq += 1
W.table("call_snippets", ["id","recording_id","start_ms","end_ms","label","transcript","severity"], snip_rows)

CATS = ["price_sensitivity","efficacy_doubt","competitor_loyalty","safety_concern",
        "formulary_restriction","supply_reliability"]
obj_rows = []
for i in range(30000):
    vid, _, _ = random.choice(VISIT_IDS)
    obj_rows.append([str(OFFSET + i), q(vid), q(random.choice(CATS)),
                     str(1 if random.random() < 0.55 else 0),
                     q("Captured from the call transcript and categorised by the objection model.")])
W.table("hcp_objections", ["id","visit_id","category","handled","detail"], obj_rows)
print("field force done", file=sys.stderr)

# ==================================================== cold chain ===========
CARRIERS = ["Blue Dart Temperature Logistics","Snowman Logistics","Gati Kausar",
 "DHL Life Sciences","TCI Cold Chain","Kuehne+Nagel Pharma","DB Schenker Healthcare",
 "UPS Healthcare","FedEx Custom Critical","ColdStar Logistics"]
BANDS = [(2.0, 8.0), (-20.0, -15.0), (15.0, 25.0), (2.0, 8.0), (-80.0, -60.0)]
SHIPMENTS, ship_rows = [], []
for i in range(5000):
    sid = f"SHP-{100000 + i}"
    lo, hi = random.choice(BANDS)
    status = random.choices(["in_transit","customs","delivered","exception","planned"],
                            [0.34, 0.1, 0.4, 0.08, 0.08])[0]
    dep = random.uniform(0.2, 60)
    SHIPMENTS.append((sid, lo, hi, status))
    ship_rows.append([q(sid), q(random.choice(WAREHOUSES)), q(random.choice(WAREHOUSES)),
        q(random.choice(REGIONS)), q(random.choice(CARRIERS)),
        q(random.choice(["road","air","sea","rail"])), q(status),
        f"{lo}", f"{hi}", q(ts(dep)), q(ts(dep - random.uniform(0.5, 4))),
        q(ts(dep - random.uniform(0.5, 3))) if status == "delivered" else "NULL"])
W.table("shipments", ["id","origin_id","destination_id","region_id","carrier","mode","status",
        "temp_min_c","temp_max_c","departed_at","eta","delivered_at"], ship_rows)

MODELS = ["Elpro LIBERO CE","Sensitech TempTale","Controlant Saga","Berlinger Q-tag",
          "Emerson GO Real-Time","Tive Solo 5G"]
LOGGERS, log_rows = [], []
for i in range(12000):
    lid = f"LGR-{200000 + i}"
    sid, lo, hi, _ = random.choice(SHIPMENTS)
    excursion = random.random() < 0.12
    temp = round(random.uniform(lo, hi) if not excursion else hi + random.uniform(0.5, 6.0), 1)
    status = random.choices(["reporting","silent","retired"], [0.86, 0.09, 0.05])[0]
    LOGGERS.append((lid, lo, hi, excursion, status))
    log_rows.append([q(lid), q(sid), q(random.choice(MODELS)), str(random.randint(4, 100)),
        q(ts(random.uniform(0, 0.2))), f"{temp}",
        f"{random.uniform(8.0, 32.0):.4f}", f"{random.uniform(68.0, 92.0):.4f}", q(status)])
W.table("iot_loggers", ["id","shipment_id","model","battery_pct","last_ping_at",
        "last_temp_c","last_lat","last_lng","status"], log_rows)

# Readings stay inside each logger's own shipment band unless that logger is
# one of the deliberate excursion cases - a hardcoded band would make every
# frozen lane look permanently breached.
read_rows = []
active = [l for l in LOGGERS if l[4] != "retired"]
for lid, lo, hi, excursion, _ in active:
    for h in range(random.randint(10, 18)):
        t = hi + random.uniform(0.4, 5.5) if (excursion and h % 3 == 0) else random.uniform(lo + 0.2, hi - 0.2)
        read_rows.append([q(lid), f"{t:.2f}",
                          f"{random.uniform(8.0, 32.0):.4f}", f"{random.uniform(68.0, 92.0):.4f}",
                          q(ts(h / 24.0))])
W.table("logger_readings", ["logger_id","temp_c","lat","lng","recorded_at"], read_rows)

KINDS = ["customs_delay","port_congestion","temp_excursion","route_deviation","logger_silent"]
DETAILS = {"customs_delay":"Held pending regulatory clearance at the entry checkpoint.",
 "port_congestion":"Dwell time exceeded the contracted window at the transhipment hub.",
 "temp_excursion":"Payload recorded outside its qualified band for a sustained period.",
 "route_deviation":"Vehicle left the planned corridor without an approved reason.",
 "logger_silent":"No telemetry received from the data logger since the last checkpoint."}
anom_rows = []
for i in range(8000):
    sid = random.choice(SHIPMENTS)[0]
    k = random.choice(KINDS)
    det = random.uniform(0, 45)
    anom_rows.append([str(OFFSET + i), q(sid), q(k),
        q(random.choices(["low","medium","high","critical"], [0.3,0.35,0.25,0.1])[0]),
        q(DETAILS[k]), q(ts(det)),
        q(ts(det - random.uniform(0.1, 5))) if random.random() < 0.55 else "NULL"])
W.table("route_anomalies", ["id","shipment_id","kind","severity","detail","detected_at","resolved_at"], anom_rows)

# Freight lanes: UNIQUE (origin, destination, mode), and never origin == dest.
lanes, lane_rows = set(), []
# Guarantee the lanes the simulator addresses by id survive.
for m in ("road","air"):
    lanes.add(("wh-north","wh-west",m)); lanes.add(("wh-west","wh-south",m))
while len(lanes) < 15000:
    a, b = random.choice(WAREHOUSES), random.choice(WAREHOUSES)
    if a != b: lanes.add((a, b, random.choice(["road","air","sea","rail"])))
for a, b, m in lanes:
    hours = {"road": random.uniform(6, 60), "air": random.uniform(2, 9),
             "sea": random.uniform(70, 400), "rail": random.uniform(20, 90)}[m]
    cost = {"road": random.randrange(600, 2600), "air": random.randrange(5000, 12000),
            "sea": random.randrange(200, 900), "rail": random.randrange(400, 1400)}[m]
    lane_rows.append([q(a), q(b), q(m), f"{hours:.1f}", str(cost),
                      str(random.choice([0, 1, 1])), f"{random.uniform(18, 44):.1f}"])
W.table("freight_lanes", ["origin_id","destination_id","mode","transit_hours",
        "cost_per_unit_minor","reefer_available","ambient_max_c"], lane_rows)

W.table("arrhenius_profiles", ["sku","activation_energy_kj","reference_temp_c",
        "reference_shelf_days","potency_floor_pct"],
    [[q(s), str(random.randint(70, 105)), f"{random.choice([5.0, 25.0, 30.0])}",
      str(random.choice([365, 540, 730, 912, 1095])), f"{random.choice([90.0, 92.5, 95.0])}"]
     for s in SKUS])

sto_rows = []
for i in range(6000):
    st = random.choices(["pending","acknowledged","failed","cancelled"], [0.2,0.6,0.1,0.1])[0]
    req = random.uniform(0, 300)
    sto_rows.append([str(OFFSET + i), "NULL",
        q(f"45000{200000 + i}") if st == "acknowledged" else "NULL",
        q(random.choice(WAREHOUSES)), q(random.choice(WAREHOUSES)), q(random.choice(SKUS)),
        str(random.randrange(50, 6000, 25)), q(st), q(random.choice(ADMINS)), q(ts(req)),
        q(ts(req - random.uniform(0.01, 2))) if st == "acknowledged" else "NULL",
        q("ERP rejected the document: material blocked for the receiving plant.") if st == "failed" else "NULL"])
W.table("sto_writebacks", ["id","plan_id","sap_doc_no","origin_id","destination_id","sku",
        "units","status","requested_by","requested_at","acknowledged_at","error_detail"], sto_rows)
print("cold chain done", file=sys.stderr)

# ==================================================== market intelligence ==
pat_rows = []
for i in range(2000):
    mol = random.choice(MOLECULES)
    pat_rows.append([q(f"PAT-{10000 + i}"), q(mol),
        q(f"{mol[:4].title()}{random.choice(['va','xa','ra','lo','mex'])}"),
        q(random.choice(COMPANIES)), q(random.choice(["IN","US","EU","JP","BR","CN","ZA"])),
        q(random.choices(["compound","formulation","process","orphan","paediatric_extension"],
                         [0.5,0.2,0.15,0.08,0.07])[0]),
        q(dt(-random.randint(-400, 2200))),
        str(random.randrange(50_000_000, 20_000_000_000, 1_000_000)),
        q(random.choice(TA))])
W.table("patents", ["id","molecule","brand","holder","market","exclusivity_type",
        "expiry_date","annual_value_minor","therapeutic_area"], pat_rows)

NETWORKS = ["Apollo Hospitals","Fortis Healthcare","Manipal Hospitals","Max Healthcare",
 "AMRI Hospitals","Narayana Health","Medanta","Aster DM","Columbia Asia","KIMS",
 "Yashoda Hospitals","Ruby Hall","Jaslok","Lilavati","Kokilaben"]
form_rows = []
for i in range(5000):
    prev = random.randint(1, 5)
    tier = max(1, min(5, prev + random.choice([-2,-1,0,0,1,2])))
    form_rows.append([str(OFFSET + i), q(random.choice(NETWORKS)),
        q(f"{random.choice(MOLECULES)} {random.choice(FORMS)}"), str(tier), str(prev),
        q(ts(random.uniform(0, 400))), q(random.choice(REGIONS))])
W.table("formulary_placements", ["id","network","product","tier","previous_tier","changed_at","region_id"], form_rows)

reg_rows = []
for i in range(5000):
    kind = random.choices(["ceiling_price","approval","recall","label_change"], [0.45,0.3,0.1,0.15])[0]
    prev = random.randrange(500, 40000) if kind == "ceiling_price" else None
    now_p = max(100, int(prev * random.uniform(0.82, 1.12))) if prev else None
    pub = random.uniform(0, 400)
    reg_rows.append([str(OFFSET + i),
        q(random.choice(["NPPA","DPCO","CDSCO","FDA","EMA"])), q(kind),
        q(f"{random.choice(MOLECULES)} {random.choice(FORMS)}"), n(now_p), n(prev),
        q({"ceiling_price":"Revised ceiling under the annual WPI-linked schedule.",
           "approval":"Marketing authorisation granted for the stated indication.",
           "recall":"Batch-level recall issued following a stability deviation.",
           "label_change":"Warnings and precautions section updated."}[kind]),
        q(dt(pub - random.uniform(-30, 5))), q(ts(pub))])
W.table("regulatory_events", ["id","authority","kind","product","ceiling_price_minor",
        "previous_price_minor","detail","effective_from","published_at"], reg_rows)

# UNIQUE (therapeutic_area, company, period): build the grid explicitly.
sov_rows = []
for area in TA:
    roster = random.sample(COMPANIES, 6) + [OWN]
    for p in PERIODS:
        weights = [random.uniform(4, 34) for _ in roster]
        total = sum(weights)
        for comp, w in zip(roster, weights):
            sov_rows.append([q(area), q(comp), q(p), f"{w / total * 100:.1f}",
                             str(1 if comp == OWN else 0)])
W.table("share_of_voice", ["therapeutic_area","company","period","sov_pct","is_own"], sov_rows)

trial_rows = []
for i in range(4000):
    own = random.random() < 0.12
    trial_rows.append([q(f"NCT{6000000 + i}"), q(OWN if own else random.choice(COMPANIES)),
        q(f"{random.choice(['AHP','BAY','SAR','TAK','NN','MK'])}-{random.randrange(1000,9999)}"),
        q(random.choice(TA)),
        q(random.choices(["preclinical","I","II","III","IV"], [0.15,0.25,0.3,0.22,0.08])[0]),
        q(random.choices(["planned","recruiting","active","completed","terminated"],
                         [0.1,0.25,0.4,0.2,0.05])[0]),
        q(dt(random.randint(60, 1400))), q(dt(-random.randint(30, 1200))),
        str(random.randint(-90, 120)), str(1 if own else 0)])
W.table("clinical_trials", ["id","sponsor","molecule","therapeutic_area","phase","status",
        "started_at","est_completion","schedule_delta_days","is_own"], trial_rows)

# ==================================================== drug discovery =======
TARGETS = ["GLP1R","F11","NLRP3","PCSK9","SGLT2","DPP4","JAK1","TYK2","BTK","KRAS",
 "EGFR","PD-L1","IL23","TNF","CGRP","SOD1","APOE","HTT","GBA","LRRK2"]
PROGRAMS, prog_rows = [], []
for i in range(1200):
    pid = f"DP-{2000 + i}"
    PROGRAMS.append(pid)
    prog_rows.append([q(pid),
        q(f"AHP-{random.randrange(1000,9999)} - {random.choice(TARGETS)} {random.choice(['inhibitor','agonist','modulator','degrader','antagonist'])}"),
        q(random.choice(TA)), q(random.choice(TARGETS)),
        q(random.choices(["discovery","preclinical","I","II","III","submitted"],
                         [0.35,0.25,0.18,0.12,0.07,0.03])[0]),
        q(random.choice(ADMINS)), q(dt(random.randint(60, 1600))),
        f"{random.uniform(0.05, 0.75):.2f}"])
W.table("discovery_programs", ["id","name","therapeutic_area","target","phase",
        "lead_user_id","started_at","ptrs"], prog_rows)

KINDS3D = ["receptor","transducer","enzyme","kinase","metabolite","zymogen","sensor","adaptor","output"]
EKINDS = ["activates","inhibits","produces","recruits","primes","cleaves"]
dm_rows = []
for i in range(1200):
    count = random.randint(6, 10)
    nodes = []
    for k in range(count):
        ang = (k / count) * 6.283
        nodes.append({"id": f"N{k}", "label": f"{random.choice(TARGETS)}{k}",
                      "kind": random.choice(KINDS3D),
                      "x": round(-3.5 + (k / max(count - 1, 1)) * 7 + random.uniform(-.4, .4), 2),
                      "y": round(1.8 * (0.5 - random.random()) * 2, 2),
                      "z": round(random.uniform(-1.0, 1.0), 2),
                      "radius": round(random.uniform(0.3, 0.65), 2),
                      "expression": round(random.uniform(0.4, 1.0), 2)})
    edges = [{"source": f"N{k}", "target": f"N{k+1}", "kind": random.choice(EKINDS),
              "weight": round(random.uniform(0.5, 0.95), 2)} for k in range(count - 1)]
    dm_rows.append([q(f"DM-{2000 + i}"), q(random.choice(PROGRAMS)),
        q(f"{random.choice(TARGETS)} {random.choice(['signalling axis','assembly cascade','regulatory loop','transport pathway'])}"),
        q(random.choice(["Type 2 Diabetes","Thrombosis","Chronic Inflammation","Dyslipidaemia",
                         "Heart Failure","Asthma","Rheumatoid Arthritis","Migraine"])),
        q(random.choice(["pathway","protein","tissue","pk_pd"])),
        q("Generated model geometry for the target pathway, used by the 3D viewer."),
        q(json.dumps(nodes)), q(json.dumps(edges)), q(ts(random.uniform(0, 200)))])
W.table("disease_models", ["id","program_id","name","disease","model_type","summary",
        "nodes","edges","updated_at"], dm_rows)

W.table("compound_candidates", ["id","program_id","code_name","binding_affinity_nm",
        "selectivity_fold","admet_score","status"],
    [[q(f"CC-{50000 + i}"), q(random.choice(PROGRAMS)),
      q(f"AHP-{random.randrange(1000,9999)}-{random.choice('ABCDEFGH')}"),
      f"{random.uniform(0.4, 90.0):.1f}", f"{random.uniform(15, 600):.0f}",
      f"{random.uniform(30, 95):.1f}",
      q(random.choices(["screening","hit","lead","optimised","dropped"],
                       [0.3,0.25,0.2,0.12,0.13])[0])] for i in range(8000)])
print("market + discovery done", file=sys.stderr)

# ==================================================== platform + services ==
SVC_PREFIX = ["Auth","Ingestion","Notification","SAP Connector","Triton Inference","Audit Trail",
 "Cold Chain Telemetry","EDI Gateway","HL7/FHIR","Serialisation","Reporting","Scheduler",
 "Search Index","Object Store","Event Bus","Rules Engine","Batch Runner","Webhook Dispatcher"]
SVC_REGION = ["Global","US-East","US-West","EU-West","EU-Central","APAC","APAC-South","MENA"]
SERVICE_IDS, svc_rows = [], []
for i in range(1000):
    sid = OFFSET + i
    SERVICE_IDS.append(sid)
    svc_rows.append([str(sid),
        q(f"{random.choice(SVC_PREFIX)} Service {i + 1:04d}"), q(random.choice(SVC_REGION)),
        q(random.choices(["Operational","Degraded","Maintenance","Outage"], [0.82,0.1,0.05,0.03])[0]),
        f"{random.uniform(96.5, 99.999):.3f}"])
W.table("services", ["id","name","region","status","uptime_pct"], svc_rows)

W.table("service_checks", ["id","service_id","latency_ms","checked_at"],
    [[str(OFFSET + i), str(random.choice(SERVICE_IDS)), str(random.randint(8, 4200)),
      q(ts(random.uniform(0, 30)))] for i in range(30000)])

INC = ["Elevated error rate on the ingestion path","Replica lag on the reporting store",
 "Certificate rotation caused brief 5xx","Queue backlog after a deploy",
 "Upstream ERP timeout","Telemetry gap for a logger fleet","Rate limit reached on a partner API",
 "Disk pressure on an event broker","Failover exercised in a secondary region"]
inc_rows = []
for i in range(2000):
    started = random.uniform(0, 400)
    st = random.choices(["Investigating","Identified","Monitoring","Resolved","Completed"],
                        [0.08,0.1,0.12,0.5,0.2])[0]
    inc_rows.append([str(OFFSET + i), q(random.choice(INC)),
        q(random.choice(["Info","Low","Medium","High"])), q(st), q(ts(started)),
        q(ts(started - random.uniform(0.05, 3))) if st in ("Resolved","Completed") else "NULL"])
W.table("incidents", ["id","title","severity","status","started_at","resolved_at"], inc_rows)

INF_MODELS = ["bionemo-esm2-650m","bionemo-esm2-3b","logistics-gnn-v3","logistics-gnn-v4",
 "callaudit-whisper-lg","callaudit-whisper-md","arrhenius-surrogate","demand-forecast-tft",
 "geofence-anomaly-xgb","objection-classifier-bert","route-eta-lgbm","stability-predictor-gnn"]
W.table("inference_metrics", ["id","model","p50_ms","p95_ms","queue_depth","gpu_util_pct","recorded_at"],
    [[str(OFFSET + i), q(random.choice(INF_MODELS)),
      f"{random.uniform(4, 400):.1f}", f"{random.uniform(12, 900):.1f}",
      str(random.randint(0, 40)), f"{random.uniform(5, 99):.1f}", q(ts(random.uniform(0, 30)))]
     for i in range(20000)])

ING_SRC = ["Distributor EDI","CSV Upload","SAP IDoc Stream","LIMS Results","Veeva CRM Sync",
 "Cold Chain Telemetry","Serialisation Events","Partner SFTP","Retail POS Feed","Wholesaler API"]
W.table("ingestion_throughput", ["id","source","records_per_sec","backlog_records","recorded_at"],
    [[str(OFFSET + i), q(random.choice(ING_SRC)), f"{random.uniform(20, 4000):.1f}",
      str(random.randrange(0, 900000, 100)), q(ts(random.uniform(0, 30)))] for i in range(20000)])

W.table("erp_sync_status", ["id","system","last_sync_at","latency_ms","records_synced","status","recorded_at"],
    [[str(OFFSET + i), q(random.choice(["SAP S/4HANA","Salesforce Veeva","Distributor EDI",
       "LIMS (Quality)","Oracle EBS","Kinaxis RapidResponse","Serialisation Hub"])),
      q(ts(random.uniform(0, 0.2))), str(random.randint(80, 9000)),
      str(random.randrange(1000, 900000)),
      q(random.choices(["healthy","lagging","failed"], [0.78,0.17,0.05])[0]),
      q(ts(random.uniform(0, 30)))] for i in range(12000)])

# UNIQUE (as_of, region_id, window_days) - build the grid, one row per day.
snap_rows = []
for d in range(365):
    for r in REGIONS:
        snap_rows.append([q(dt(d)), q(r), "150",
            str(int(2_450_000_000 + random.uniform(-2e8, 2.2e8) - d * 5_200_000)),
            str(int(360_000_000 + random.uniform(-4e7, 6e7) + d * 2_400_000)),
            str(int(4200 + random.uniform(-500, 900) - d * 12))])
W.table("expiry_risk_snapshots", ["as_of","region_id","window_days",
        "gross_value_at_risk_minor","capital_saved_minor","units_at_risk"], snap_rows)

# ==================================================== plans & ingestion ====
PLAN_IDS, plan_rows, step_rows = [], [], []
for i in range(3000):
    pid = OFFSET + i
    PLAN_IDS.append(pid)
    plan_rows.append([str(pid),
        q(f"Move {random.randrange(200, 6000, 50)} units of {random.choice(MOLECULES)} to relieve expiry exposure."),
        q(random.choices(["draft","approved","executed","cancelled"], [0.3,0.3,0.3,0.1])[0]),
        q(random.choice(ADMINS)), q(ts(random.uniform(0, 300)))])
    for o in range(random.randint(3, 5)):
        step_rows.append([str(pid), str(o), q(random.choice([
            "Confirm reefer availability on the selected lane.",
            "Raise the Stock Transport Order in SAP.",
            "Verify the receiving plant has cold-chain capacity.",
            "Re-check the source safety stock after allocation.",
            "Notify the regional compliance officer.",
            "Schedule the pick and pack window.",
            "Attach the stability justification to the batch record."]))])
W.table("redistribution_plans", ["id","summary","status","created_by","created_at"], plan_rows)
W.table("redistribution_steps", ["plan_id","ordinal","instruction"], step_rows)

DS_IDS, ds_rows, dcol_rows, drow_rows = [], [], [], []
COLS = [("Batch Code","batchCode","Batch Code"),("SKU","sku","SKU"),("Product","name","Product"),
        ("Qty","quantity","Quantity"),("Value","valueMinor","Value"),("Expiry","expiryDate","Expiry"),
        ("Region","region","Region"),("Warehouse","warehouse","Warehouse"),
        ("Status","status","Status"),("Lot","lot","Lot")]
for i in range(1200):
    did = f"ds-{20000 + i:06d}"
    DS_IDS.append(did)
    ncols = random.randint(5, 10)
    ds_rows.append([q(did), q(random.choice(ADMINS)), q(f"distributor_extract_{i + 1:04d}.csv"),
                    "0", str(ncols), "NULL", q(ts(random.uniform(0, 300)))])
    for o in range(ncols):
        orig, key, lab = COLS[o]
        dcol_rows.append([q(did), str(o), q(orig), q(key), q(lab)])
W.table("datasets", ["id","uploaded_by","filename","row_count","column_count","r2_key","uploaded_at"], ds_rows)
W.table("dataset_columns", ["dataset_id","ordinal","original_name","mapped_key","label"], dcol_rows)

for i in range(25000):
    did = random.choice(DS_IDS)
    payload = {"batchCode": f"P-{random.randrange(500000, 520000)}", "sku": random.choice(SKUS),
               "quantity": random.randrange(50, 5000), "region": random.choice(REGIONS),
               "status": random.choice(["Good","Warning","Critical"])}
    drow_rows.append([str(OFFSET + i), q(did), str(i), q(json.dumps(payload))])
W.table("dataset_rows", ["id","dataset_id","row_index","data"], drow_rows)

# ==================================================== governance ===========
# Bounded by `users`, which is frozen at two accounts by request. These are
# per-user records, so the volume here is a credential/signature HISTORY for
# those two signers rather than a wide population.
cred_rows, CREDS = [], []
for i in range(1000):
    u = ADMINS[i % 2]
    cid = f"SIG-AH-{10000 + i}"
    st = random.choices(["expired","revoked","active"], [0.75, 0.2, 0.05])[0]
    iss = random.uniform(200, 2000)
    CREDS.append((cid, u))
    cred_rows.append([q(cid), q(u), q(ts(iss)), q(ts(iss - 365)), q(st),
                      q(ts(iss - random.uniform(10, 300))) if st == "revoked" else "NULL",
                      q(random.choice(ADMINS)) if st == "revoked" else "NULL"])
W.table("signature_credentials", ["id","user_id","issued_at","expires_at","status",
        "revoked_at","revoked_by"], cred_rows)

REC_TYPES = ["redistribution_plan","batch_release","audit_export","sto_writeback",
             "deviation_report","change_control","supplier_qualification"]
W.table("part11_signoffs", ["id","user_id","credential_id","record_type","record_id",
        "meaning","signed_at","payload_hash"],
    [(lambda c: [str(OFFSET + i), q(c[1]), q(c[0]), q(random.choice(REC_TYPES)),
                 q(str(random.randrange(100000, 120000))),
                 q(random.choice(["approved","reviewed","authored","responsibility"])),
                 q(ts(random.uniform(0, 400))),
                 q("".join(random.choice("0123456789abcdef") for _ in range(16)))])(random.choice(CREDS))
     for i in range(20000)])

ENTITIES = ["inventory_batch","hcp_visit","redistribution_plan","sto_writeback","user",
            "service","shipment","formulary_placement","compound_candidate"]
FIELDS = ["status","quantity","tier","geo_verified","designation_id","region_id","units","phase"]
W.table("audit_trail", ["id","user_id","action","entity_type","entity_id","field",
        "old_value","new_value","reason","occurred_at","region_id"],
    [[str(OFFSET + i), q(random.choice(ADMINS)),
      q(random.choices(["update","create","delete","sign"], [0.55,0.25,0.05,0.15])[0]),
      q(random.choice(ENTITIES)), q(str(random.randrange(100000, 120000))),
      q(random.choice(FIELDS)), q(random.choice(["Good","Warning","1","0","draft","2","north"])),
      q(random.choice(["Critical","Warning","0","1","approved","1","west"])),
      q(random.choice(["Stability excursion recorded in transit","Periodic review",
        "Corrective action per SOP-QA-021","Data correction after reconciliation",
        "Authorised under the delegation matrix"])),
      q(ts(random.uniform(0, 500))), q(random.choice(REGIONS))] for i in range(30000)])

scope_rows = []
for u in ADMINS:
    for r in REGIONS: scope_rows.append([q(u), q("region"), q(r)])
    for w in random.sample(WAREHOUSES, 490): scope_rows.append([q(u), q("warehouse"), q(w)])
    for t in ["MENA","APAC","EMEA","LATAM","NA","SAARC","ASEAN","ANZ"]:
        scope_rows.append([q(u), q("territory"), q(t)])
W.table("user_scopes", ["user_id","scope_type","scope_id"], scope_rows)

W.flush()
total = sum(W.counts.values())
print(json.dumps({"tables": len(W.counts), "rows": total, "files": W.part,
                  "per_table": dict(sorted(W.counts.items()))}, indent=1))
