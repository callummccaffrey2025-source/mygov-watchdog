#!/usr/bin/env python3
"""
ingest_abs_demographics.py — Pull Census 2021 electorate demographics from the
ABS Data API and populate the electorate_demographics table.

API: https://data.api.abs.gov.au/rest/data/ABS,C21_{table}_CED,1.0.0/all
Tables used:
  G02 — Medians/averages (income, age, rent, mortgage, household size)
  G37 — Tenure type (own outright, own with mortgage, renting)
  G01 — Population totals
  G54 — Industry of employment (top industries per electorate)

Matches to electorates by name (fuzzy). Idempotent via UPSERT on
(electorate_id, census_year).

Note: This is Census 2021 data on 2021 boundaries. Some electorates were
redistributed for 2025. The app should note "Based on 2021 Census."
"""

import csv
import io
import json
import logging
import os
import sys
import time
from collections import defaultdict

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

API_BASE = "https://data.api.abs.gov.au/rest/data/ABS"
CSV_HEADERS = {"Accept": "application/vnd.sdmx.data+csv;labels=both"}
CENSUS_YEAR = 2021


def fetch_abs_csv(table_code: str) -> list[dict]:
    """Fetch a Census table as labelled CSV from the ABS Data API."""
    url = f"{API_BASE},C21_{table_code}_CED,1.0.0/all"
    log.info("Fetching %s...", url)
    resp = requests.get(url, headers=CSV_HEADERS, timeout=120)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text))
    rows = list(reader)
    log.info("  %s: %d rows", table_code, len(rows))
    return rows


def extract_electorate_name(region_label: str) -> str:
    """Extract electorate name from ABS region label like '105: Blaxland'."""
    if ":" in region_label:
        return region_label.split(":", 1)[1].strip()
    return region_label.strip()


def parse_g02(rows: list[dict]) -> dict[str, dict]:
    """Parse G02 medians into per-electorate dicts."""
    data: dict[str, dict] = defaultdict(dict)
    metric_map = {
        "1: Median age of persons": "median_age",
        "2: Median total personal income ($/weekly)": "median_personal_income_weekly",
        "3: Median total family income ($/weekly)": "median_family_income_weekly",
        "4: Median total household income ($/weekly)": "median_household_income_weekly",
        "5: Median mortgage repayment ($/monthly)": "median_mortgage_monthly",
        "6: Median rent ($/weekly)": "median_rent_weekly",
        "7: Average number of persons per bedroom": "avg_persons_per_bedroom",
        "8: Average household size": "avg_household_size",
    }
    for row in rows:
        name = extract_electorate_name(row.get("REGION: Region", ""))
        metric_label = row.get("MEDAVG: Median/Average", "")
        value = row.get("OBS_VALUE", "")
        field = metric_map.get(metric_label)
        if field and name and value:
            try:
                data[name][field] = float(value)
            except ValueError:
                pass
    return dict(data)


def parse_g01_population(rows: list[dict]) -> dict[str, int]:
    """Parse G01 for total population per electorate."""
    pop = {}
    for row in rows:
        name = extract_electorate_name(row.get("REGION: Region", ""))
        # G01 has SEXP (sex) dimension — we want "3: Persons" total
        sex = row.get("SEXP: Sex", "")
        char = row.get("CHARACT: Selected Person Characteristics", "")
        if "Persons" in sex and "Total" in char:
            val = row.get("OBS_VALUE", "")
            if name and val:
                try:
                    pop[name] = int(float(val))
                except ValueError:
                    pass
    return pop


def parse_g37_tenure(rows: list[dict]) -> dict[str, dict]:
    """Parse G37 tenure data. Returns {electorate: {pct_owned_outright, pct_owned_mortgage, pct_renting}}."""
    # G37 from the CSV API has different structure — let me use the DataPack CSVs instead
    # Actually, let's compute from the downloaded CSVs since the API format is complex
    return {}


def parse_g37_from_csv() -> dict[str, dict]:
    """Parse tenure from the downloaded DataPack CSV (simpler column structure)."""
    csv_path = "/tmp/abs_data/census_ced/2021 Census GCP Commonwealth Electroral Division for AUS/2021Census_G37_AUST_CED.csv"
    if not os.path.exists(csv_path):
        log.warning("G37 CSV not found at %s", csv_path)
        return {}

    # Also need the CED code → name mapping from G02 API data
    # We'll map CED codes to names using the G02 data we already fetched
    g02_rows = fetch_abs_csv("G02")
    code_to_name = {}
    for row in g02_rows:
        region = row.get("REGION: Region", "")
        if ":" in region:
            code = region.split(":")[0].strip()
            name = region.split(":", 1)[1].strip()
            code_to_name[f"CED{code}"] = name

    tenure = {}
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            ced_code = row.get("CED_CODE_2021", "")
            name = code_to_name.get(ced_code, "")
            if not name:
                continue

            owned_outright = _safe_int(row.get("O_OR_Total", 0))
            owned_mortgage = _safe_int(row.get("O_MTG_Total", 0))
            renting_total = _safe_int(row.get("R_Tot_Total", 0))
            total = _safe_int(row.get("Total_Total", 0))

            if total > 0:
                tenure[name] = {
                    "pct_owned_outright": round(owned_outright / total * 100, 1),
                    "pct_owned_mortgage": round(owned_mortgage / total * 100, 1),
                    "pct_renting": round(renting_total / total * 100, 1),
                }
    log.info("Parsed tenure for %d electorates from CSV.", len(tenure))
    return tenure


def parse_industry_from_csv() -> dict[str, list[dict]]:
    """Parse top industries per electorate from G54A + G54B DataPack CSVs."""
    csv_a = "/tmp/abs_data/census_ced/2021 Census GCP Commonwealth Electroral Division for AUS/2021Census_G54A_AUST_CED.csv"
    csv_b = "/tmp/abs_data/census_ced/2021 Census GCP Commonwealth Electroral Division for AUS/2021Census_G54B_AUST_CED.csv"

    if not os.path.exists(csv_a):
        log.warning("G54A CSV not found")
        return {}

    # Build CED code → name mapping
    g02_rows = fetch_abs_csv("G02")
    code_to_name = {}
    for row in g02_rows:
        region = row.get("REGION: Region", "")
        if ":" in region:
            code = region.split(":")[0].strip()
            name = region.split(":", 1)[1].strip()
            code_to_name[f"CED{code}"] = name

    # Industry column prefixes (male) → human name
    industry_cols = {
        "Ag_For_Fshg": "Agriculture, Forestry & Fishing",
        "Mining": "Mining",
        "Manufact": "Manufacturing",
        "El_Gas_Wt_Waste": "Electricity, Gas, Water & Waste",
        "Constru": "Construction",
        "WhlesaleTde": "Wholesale Trade",
        "RetTde": "Retail Trade",
        "Accom_food": "Accommodation & Food Services",
        "Trans_post_wrehsg": "Transport, Postal & Warehousing",
        "Info_media_teleco": "Information Media & Telecommunications",
        "Fin_Insur": "Financial & Insurance Services",
        "RtnHir_REst": "Rental, Hiring & Real Estate",
        "Pro_scien_tec": "Professional, Scientific & Technical",
        "Admin_supp": "Administrative & Support Services",
        "Public_admin_sfty": "Public Administration & Safety",
        "Educ_trng": "Education & Training",
        "HlthCare_SocAs": "Health Care & Social Assistance",
        "Art_recn": "Arts & Recreation Services",
        "Oth_scs": "Other Services",
    }

    # Read G54A (male totals) and G54B (female totals + male grand total)
    male_data = {}
    with open(csv_a) as f:
        reader = csv.DictReader(f)
        for row in reader:
            male_data[row["CED_CODE_2021"]] = row

    female_data = {}
    with open(csv_b) as f:
        reader = csv.DictReader(f)
        for row in reader:
            female_data[row["CED_CODE_2021"]] = row

    results = {}
    for ced_code in male_data:
        name = code_to_name.get(ced_code, "")
        if not name:
            continue

        m_row = male_data[ced_code]
        f_row = female_data.get(ced_code, {})

        industries = []
        for col_prefix, label in industry_cols.items():
            m_total = _safe_int(m_row.get(f"M_{col_prefix}_Tot", 0))
            f_total = _safe_int(f_row.get(f"F_{col_prefix}_Tot", 0))
            total = m_total + f_total
            if total > 0:
                industries.append({"name": label, "count": total})

        # Sort by count descending, take top 5
        industries.sort(key=lambda x: x["count"], reverse=True)
        grand_total = sum(i["count"] for i in industries)
        top5 = []
        for ind in industries[:5]:
            pct = round(ind["count"] / grand_total * 100, 1) if grand_total > 0 else 0
            top5.append({"name": ind["name"], "count": ind["count"], "pct": pct})
        results[name] = top5

    log.info("Parsed industries for %d electorates.", len(results))
    return results


def _safe_int(val) -> int:
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def match_electorate(db, name: str, cache: dict) -> str | None:
    """Match an ABS electorate name to the electorates table."""
    key = name.lower().strip()
    if key in cache:
        return cache[key]

    result = (
        db.table("electorates")
        .select("id")
        .ilike("name", name.strip())
        .execute()
    )
    if result.data:
        cache[key] = result.data[0]["id"]
        return result.data[0]["id"]

    # Try fuzzy: first word match
    first_word = name.strip().split()[0] if name.strip() else ""
    if first_word and len(first_word) > 3:
        result2 = (
            db.table("electorates")
            .select("id, name")
            .ilike("name", f"{first_word}%")
            .execute()
        )
        if result2.data and len(result2.data) == 1:
            cache[key] = result2.data[0]["id"]
            return result2.data[0]["id"]

    log.debug("No electorate match for %r", name)
    cache[key] = None
    return None


def main() -> None:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    db = create_client(url, key)
    dry_run = "--dry-run" in sys.argv

    # Fetch G02 (medians) from API
    g02_rows = fetch_abs_csv("G02")
    medians = parse_g02(g02_rows)
    log.info("G02: %d electorates with medians.", len(medians))

    # Parse tenure from downloaded CSV
    tenure = parse_g37_from_csv()

    # Parse industries from downloaded CSV
    industries = parse_industry_from_csv()

    # Build combined rows
    electorate_cache: dict = {}
    all_names = set(medians.keys()) | set(tenure.keys()) | set(industries.keys())
    log.info("Total unique electorate names: %d", len(all_names))

    rows = []
    matched = 0
    for name in sorted(all_names):
        eid = match_electorate(db, name, electorate_cache)
        if not eid:
            continue
        matched += 1

        m = medians.get(name, {})
        t = tenure.get(name, {})
        ind = industries.get(name, [])

        row = {
            "electorate_id": eid,
            "census_year": CENSUS_YEAR,
            "median_age": m.get("median_age"),
            "median_household_income_weekly": m.get("median_household_income_weekly"),
            "median_personal_income_weekly": m.get("median_personal_income_weekly"),
            "median_family_income_weekly": m.get("median_family_income_weekly"),
            "median_rent_weekly": m.get("median_rent_weekly"),
            "median_mortgage_monthly": m.get("median_mortgage_monthly"),
            "avg_household_size": m.get("avg_household_size"),
            "pct_owned_outright": t.get("pct_owned_outright"),
            "pct_owned_mortgage": t.get("pct_owned_mortgage"),
            "pct_renting": t.get("pct_renting"),
            "top_industries": json.dumps(ind) if ind else None,
            "source_url": "https://www.abs.gov.au/census",
        }
        rows.append(row)

    log.info("Matched %d electorates to DB, %d unmatched.",
             matched, len(all_names) - matched)

    if dry_run:
        log.info("DRY RUN — sample rows:")
        for r in rows[:5]:
            log.info("  %s: income=$%s/wk, age=%s, rent=$%s/wk, own=%s%%, rent_pct=%s%%",
                     r["electorate_id"][:8], r["median_household_income_weekly"],
                     r["median_age"], r["median_rent_weekly"],
                     r["pct_owned_outright"], r["pct_renting"])
            if r["top_industries"]:
                inds = json.loads(r["top_industries"])
                for i in inds[:3]:
                    log.info("    %s: %d (%s%%)", i["name"], i["count"], i["pct"])
        log.info("  ... (%d total rows)", len(rows))
        return

    if not rows:
        log.warning("No rows to insert. Exiting.")
        return

    # Upsert in batches
    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        result = (
            db.table("electorate_demographics")
            .upsert(batch, on_conflict="electorate_id,census_year")
            .execute()
        )
        total += len(result.data)
        time.sleep(0.2)

    log.info("Done. %d electorate demographics upserted.", total)


if __name__ == "__main__":
    main()
