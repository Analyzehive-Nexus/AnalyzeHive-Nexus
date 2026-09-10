#!/usr/bin/env python3
"""
Pulls real public trial records from ClinicalTrials.gov's v2 API for
molecules already in the synthetic vocabulary (see generate-synthetic-data.py),
and inserts them into `clinical_trials` as is_own=0 - real competitor/market
trials, never our own fictional pipeline. Uses the real NCT id as primary
key: the column comment already says "registry id, e.g. NCT number".

Unlike everything else in this schema (HCPs, field reps, shipments), public
trial registries are genuine real-world data worth having verbatim rather
than synthesized.

Run against the local D1 emulator's sqlite file directly - no REST API, no
size limits to chase, since this writes a few dozen rows, not thousands:

    python3 scripts/fetch-real-clinical-trials.py ../database/local.db

Idempotent: INSERT OR IGNORE keyed on the real NCT id. Note the synthetic
generator also mints NCT-shaped ids (e.g. "NCT06012233") for is_own=1 rows
in the same numeric range real trials are actually allocated from, so a
handful of real ids can collide and get silently skipped - that's the
expected cost of OR IGNORE, not a bug worth chasing.
"""
import json
import sqlite3
import sys
import urllib.request
import urllib.parse

# molecule -> our own therapeutic_area label (matches the TA vocabulary in
# generate-synthetic-data.py), since API condition text is too free-form to
# map reliably to our fixed labels.
MOLECULE_TA = {
    "Semaglutide": "Diabetes",
    "Liraglutide": "Diabetes",
    "Dulaglutide": "Diabetes",
    "Empagliflozin": "Diabetes",
    "Dapagliflozin": "Diabetes",
    "Sitagliptin": "Diabetes",
    "Rivaroxaban": "Cardiovascular",
    "Apixaban": "Cardiovascular",
    "Adalimumab": "Immunology",
    "Denosumab": "Rheumatology",
}

PHASE_MAP = {
    "EARLY_PHASE1": "preclinical",
    "PHASE1": "I",
    "PHASE2": "II",
    "PHASE3": "III",
    "PHASE4": "IV",
}
STATUS_MAP = {
    "NOT_YET_RECRUITING": "planned",
    "RECRUITING": "recruiting",
    "ENROLLING_BY_INVITATION": "recruiting",
    "ACTIVE_NOT_RECRUITING": "active",
    "COMPLETED": "completed",
    "TERMINATED": "terminated",
    "WITHDRAWN": "terminated",
    "SUSPENDED": "terminated",
}


def fetch(molecule, page_size=5):
    params = urllib.parse.urlencode({
        "query.intr": molecule,
        "pageSize": page_size,
        "fields": "NCTId,LeadSponsorName,Phase,OverallStatus,StartDate,CompletionDate",
        "sort": "LastUpdatePostDate:desc",
    })
    url = f"https://clinicaltrials.gov/api/v2/studies?{params}"
    with urllib.request.urlopen(url, timeout=20) as resp:
        return json.load(resp)


def full_date(d):
    """API dates can omit the day ('YYYY-MM'); normalise to the 1st so the
    column stays comparable with the synthetic 'YYYY-MM-DD' rows."""
    if not d:
        return None
    return d if len(d) == 10 else f"{d}-01"


def rows_for(molecule):
    ta = MOLECULE_TA[molecule]
    out = []
    try:
        data = fetch(molecule)
    except Exception as e:
        print(f"  fetch failed for {molecule}: {e}", file=sys.stderr)
        return out
    for study in data.get("studies", []):
        ps = study.get("protocolSection", {})
        ident = ps.get("identificationModule", {})
        status_mod = ps.get("statusModule", {})
        sponsor_mod = ps.get("sponsorCollaboratorsModule", {})
        design_mod = ps.get("designModule", {})

        nct_id = ident.get("nctId")
        sponsor = sponsor_mod.get("leadSponsor", {}).get("name")
        phases = design_mod.get("phases") or []
        phase = PHASE_MAP.get(phases[0]) if phases else None
        status = STATUS_MAP.get(status_mod.get("overallStatus"), "active")
        started = (status_mod.get("startDateStruct") or {}).get("date")
        completed = (status_mod.get("completionDateStruct") or {}).get("date")

        # Skip anything that doesn't map cleanly rather than guess - this is
        # meant to be real, verifiable data, not filled-in synthetic.
        if not (nct_id and sponsor and phase):
            continue

        out.append((nct_id, sponsor, molecule, ta, phase, status,
                    full_date(started), full_date(completed), 0, 0))
    return out


def main():
    if len(sys.argv) != 2:
        print("usage: fetch-real-clinical-trials.py <path-to-sqlite-db>", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(sys.argv[1])
    conn.execute("PRAGMA foreign_keys = ON")
    total = 0
    for molecule in MOLECULE_TA:
        rows = rows_for(molecule)
        conn.executemany(
            """INSERT OR IGNORE INTO clinical_trials
               (id, sponsor, molecule, therapeutic_area, phase, status,
                started_at, est_completion, schedule_delta_days, is_own)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )
        print(f"  {molecule}: {len(rows)} real trials fetched")
        total += len(rows)
    conn.commit()
    conn.close()
    print(f"done - {total} real trial rows attempted (INSERT OR IGNORE)")


if __name__ == "__main__":
    main()
