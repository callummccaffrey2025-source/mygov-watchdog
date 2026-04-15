#!/usr/bin/env python3
"""
seed_councils.py — Seed the 20 largest Australian councils into the councils table.
Upserts on name. Idempotent.
"""
import logging
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

COUNCILS = [
    {
        "name": "City of Sydney",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Clover Moore",
        "website": "https://www.cityofsydney.nsw.gov.au",
        "area_postcodes": ["2000", "2007", "2008", "2009", "2010", "2011", "2016", "2017", "2018", "2019", "2020", "2021"],
    },
    {
        "name": "City of Melbourne",
        "state": "VIC",
        "type": "city",
        "mayor_name": "Nicholas Reece",
        "website": "https://www.melbourne.vic.gov.au",
        "area_postcodes": ["3000", "3001", "3002", "3003", "3004", "3005", "3006", "3008"],
    },
    {
        "name": "Brisbane City Council",
        "state": "QLD",
        "type": "city",
        "mayor_name": "Adrian Schrinner",
        "website": "https://www.brisbane.qld.gov.au",
        "area_postcodes": ["4000", "4001", "4005", "4006", "4007", "4030", "4051", "4059", "4064", "4068", "4101", "4102"],
    },
    {
        "name": "City of Perth",
        "state": "WA",
        "type": "city",
        "mayor_name": "Basil Zempilas",
        "website": "https://www.cityofperth.wa.gov.au",
        "area_postcodes": ["6000", "6001", "6003", "6004", "6005", "6008"],
    },
    {
        "name": "Adelaide City Council",
        "state": "SA",
        "type": "city",
        "mayor_name": "Jane Lomax-Smith",
        "website": "https://www.cityofadelaide.com.au",
        "area_postcodes": ["5000", "5001", "5006"],
    },
    {
        "name": "City of Hobart",
        "state": "TAS",
        "type": "city",
        "mayor_name": "Anna Reynolds",
        "website": "https://www.hobartcity.com.au",
        "area_postcodes": ["7000", "7001", "7004", "7005", "7008"],
    },
    {
        "name": "City of Darwin",
        "state": "NT",
        "type": "city",
        "mayor_name": "Jo Hersey",
        "website": "https://www.darwin.nt.gov.au",
        "area_postcodes": ["0800", "0810", "0812", "0820"],
    },
    {
        "name": "City of Parramatta",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Pierre Esber",
        "website": "https://www.cityofparramatta.nsw.gov.au",
        "area_postcodes": ["2150", "2151", "2116", "2117", "2118", "2119", "2120", "2121", "2122", "2125", "2126"],
    },
    {
        "name": "Canterbury-Bankstown Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Bilal El-Hayek",
        "website": "https://www.cbcity.nsw.gov.au",
        "area_postcodes": ["2193", "2194", "2195", "2196", "2197", "2198", "2199", "2200", "2201", "2202", "2203"],
    },
    {
        "name": "Blacktown City Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Brad Bunting",
        "website": "https://www.blacktown.nsw.gov.au",
        "area_postcodes": ["2145", "2146", "2147", "2148", "2153", "2155", "2156", "2768", "2769"],
    },
    {
        "name": "Liverpool City Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Charishma Kaliyanda",
        "website": "https://www.liverpool.nsw.gov.au",
        "area_postcodes": ["2170", "2171", "2172", "2173", "2174", "2175", "2176"],
    },
    {
        "name": "Penrith City Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Todd Carney",
        "website": "https://www.penrithcity.nsw.gov.au",
        "area_postcodes": ["2740", "2745", "2747", "2748", "2749", "2750", "2751", "2752"],
    },
    {
        "name": "City of Gold Coast",
        "state": "QLD",
        "type": "city",
        "mayor_name": "Tom Tate",
        "website": "https://www.goldcoast.qld.gov.au",
        "area_postcodes": ["4210", "4211", "4212", "4213", "4214", "4215", "4216", "4217", "4218", "4219", "4220", "4221", "4225", "4226", "4227", "4228"],
    },
    {
        "name": "Logan City Council",
        "state": "QLD",
        "type": "city",
        "mayor_name": "Darren Power",
        "website": "https://www.logan.qld.gov.au",
        "area_postcodes": ["4114", "4118", "4119", "4120", "4121", "4122", "4123", "4124", "4125", "4126", "4127", "4128", "4129", "4130", "4131"],
    },
    {
        "name": "Moreton Bay Regional Council",
        "state": "QLD",
        "type": "regional",
        "mayor_name": "Peter Flannery",
        "website": "https://www.moretonbay.qld.gov.au",
        "area_postcodes": ["4500", "4501", "4502", "4503", "4504", "4505", "4506", "4507", "4508", "4509", "4510", "4511", "4512"],
    },
    {
        "name": "City of Casey",
        "state": "VIC",
        "type": "city",
        "mayor_name": "Stefan Koomen",
        "website": "https://www.casey.vic.gov.au",
        "area_postcodes": ["3175", "3977", "3978", "3980", "3805", "3806", "3807", "3808", "3809", "3810"],
    },
    {
        "name": "City of Wyndham",
        "state": "VIC",
        "type": "city",
        "mayor_name": "Intaj Khan",
        "website": "https://www.wyndham.vic.gov.au",
        "area_postcodes": ["3024", "3028", "3029", "3030", "3337", "3338", "3340"],
    },
    {
        "name": "Randwick City Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Dylan Parker",
        "website": "https://www.randwick.nsw.gov.au",
        "area_postcodes": ["2031", "2032", "2033", "2034", "2035", "2036"],
    },
    {
        "name": "Bayside Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Bill Saravinovski",
        "website": "https://www.bayside.nsw.gov.au",
        "area_postcodes": ["2216", "2217", "2218", "2219", "2220", "2221", "2222", "2223", "2224", "2225", "2226", "2227", "2228", "2229", "2230"],
    },
    {
        "name": "Northern Beaches Council",
        "state": "NSW",
        "type": "city",
        "mayor_name": "Sue Heins",
        "website": "https://www.northernbeaches.nsw.gov.au",
        "area_postcodes": ["2086", "2087", "2088", "2089", "2090", "2091", "2092", "2093", "2094", "2095", "2096", "2097", "2099", "2100", "2101", "2102", "2103", "2104", "2105", "2106", "2107", "2108", "2109"],
    },
]


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    db = create_client(url, key)

    inserted = 0
    for council in COUNCILS:
        db.table("councils").upsert(council, on_conflict="name").execute()
        inserted += 1
        log.info("  ✓  %s (%s)", council["name"], council["state"])

    log.info("Done. %d councils upserted.", inserted)


if __name__ == "__main__":
    main()
