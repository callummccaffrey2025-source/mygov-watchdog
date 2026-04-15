#!/usr/bin/env python3
"""
seed_party_policies_manual.py — Seed party_policies with hardcoded, factual
policy summaries for the 5 major Australian parties across 8 categories.

Upserts on (party_id, category). Idempotent. Does NOT require an API key.
"""
import logging
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# (party_short_name, category, summary_plain)
POLICIES: list[tuple[str, str, str]] = [
    # ── Australian Labor Party ───────────────────────────────────────────────
    ("Labor", "housing",
     "Committed to building 1.2 million new homes by 2029 through the Housing Australia Future Fund. "
     "Supports the Help to Buy shared equity scheme for first home buyers, enabling the government to "
     "co-purchase up to 40% of a home to reduce upfront costs."),

    ("Labor", "healthcare",
     "Strengthening Medicare with the rollout of urgent care clinics to ease emergency department pressure. "
     "Investing in mental health services and supporting bulk billing incentive payments for GPs to keep "
     "doctor visits free for pensioners, children, and concession card holders."),

    ("Labor", "economy",
     "Focus on wages growth and cost of living relief through energy bill rebates and cheaper childcare via "
     "increased subsidy rates. Committed to responsible budget management while investing in clean energy "
     "industries and manufacturing as future economic pillars."),

    ("Labor", "climate",
     "Targets net zero emissions by 2050 with an 82% renewable energy target by 2030. The Rewiring the "
     "Nation plan invests in electricity transmission infrastructure to connect new renewable energy zones "
     "to the grid and lower power bills over time."),

    ("Labor", "defence",
     "Pursuing the AUKUS nuclear-powered submarine partnership with the US and UK. Increasing defence "
     "spending toward 2.4% of GDP and focusing on Indo-Pacific security, including strengthening ties "
     "with Pacific island nations through the Pacific Engagement Visa."),

    ("Labor", "immigration",
     "Increased the skilled migration cap and introduced pathway reforms for temporary visa holders. "
     "Pacific engagement programs provide pathways for workers from Pacific nations. Committed to "
     "processing asylum seeker claims more efficiently."),

    ("Labor", "education",
     "Established fee-free TAFE places to boost vocational training and close skills gaps. Progressing "
     "the Universities Accord to improve accessibility and funding equity. Increased school funding under "
     "the National School Reform Agreement."),

    ("Labor", "cost_of_living",
     "Delivering energy bill relief of up to $300 for eligible households. Made childcare cheaper by "
     "increasing the childcare subsidy for most families. Cheaper medicines through PBS reforms have "
     "reduced the maximum co-payment for prescriptions."),

    # ── Liberal Party ────────────────────────────────────────────────────────
    ("Liberal", "housing",
     "Supports first home buyers through the Home Guarantee Scheme, allowing purchases with as little as "
     "a 5% deposit without lenders mortgage insurance. Advocates for increasing housing supply through "
     "planning reform and reducing regulatory barriers on new construction."),

    ("Liberal", "healthcare",
     "Supports bulk billing and has backed increases to Medicare Benefits Schedule rebates. Committed to "
     "mental health funding and expanding access to telehealth services in rural and regional areas. "
     "Advocates for the role of private health insurance in reducing pressure on the public system."),

    ("Liberal", "economy",
     "Advocates for lower personal and company taxes and reducing government spending to return the "
     "budget to surplus. Supports deregulation to help small businesses grow and opposes new taxes on "
     "investment and enterprise that could stifle economic activity."),

    ("Liberal", "climate",
     "Supports a technology-led approach to emissions reduction without mandated economy-wide targets "
     "that could harm industries or raise costs. Views gas as an important transition fuel and has backed "
     "carbon capture and storage as part of a practical emissions reduction toolkit."),

    ("Liberal", "defence",
     "Strong supporter of the AUKUS submarine partnership and committed to increasing defence spending. "
     "Advocates for robust border security and a strong naval presence in the Indo-Pacific to deter "
     "adversaries and maintain stability in the region."),

    ("Liberal", "immigration",
     "Supports a reduced permanent migration intake focused on skills-based selection. Advocates for "
     "stronger visa integrity measures and faster processing of genuine applicants while deterring "
     "visa misuse. Introduced the successful Pacific Labour Scheme."),

    ("Liberal", "education",
     "Supports school choice and maintains funding for independent and Catholic schools. Backs "
     "performance-based university funding to improve outcomes. Emphasises literacy and numeracy "
     "standards in primary schools and supports vocational pathways as alternatives to university."),

    ("Liberal", "cost_of_living",
     "Advocates for tax relief as the primary lever for easing cost of living pressures. Has previously "
     "introduced fuel excise cuts and opposed new taxes or regulations that raise costs for consumers "
     "and businesses. Supports energy supply diversity to keep power prices competitive."),

    # ── Australian Greens ────────────────────────────────────────────────────
    ("Greens", "housing",
     "Proposes building 1 million public and community homes over 20 years funded by the federal "
     "government. Calls for a national rent freeze and rent controls to immediately reduce housing "
     "costs. Wants to ban large corporate landlords from owning residential properties."),

    ("Greens", "healthcare",
     "Wants dental and mental health services included in Medicare so they are fully covered. Advocates "
     "for free GP visits for everyone, not just concession card holders. Supports fully funding public "
     "hospitals to eliminate waiting lists and co-payments."),

    ("Greens", "economy",
     "Calls for a tax on billionaires and a windfall profits tax on fossil fuel and gas companies to "
     "fund public services. Opposes cuts to public spending and advocates for stronger government "
     "investment in housing, health, and education financed by taxing wealth and corporate profits."),

    ("Greens", "climate",
     "Opposes all new coal, oil, and gas projects and calls for 100% renewable energy by 2030. "
     "Advocates for a Green New Deal with massive public investment in clean energy and the "
     "transition of fossil fuel workers into new industries. Committed to a nuclear-free Australia."),

    ("Greens", "defence",
     "Opposes the AUKUS nuclear submarine program and calls for the funds to be redirected to social "
     "services and climate action. Advocates for a foreign policy based on diplomacy and wants "
     "Australia to sign the UN Treaty on the Prohibition of Nuclear Weapons."),

    ("Greens", "immigration",
     "Calls for a significant increase in Australia's refugee intake and an end to offshore detention "
     "on Nauru and Manus Island. Advocates for permanent visas for all refugees and a faster, fairer "
     "processing system. Supports increased family reunion pathways."),

    ("Greens", "education",
     "Advocates for free university education for all Australians and the abolition of HECS-HELP "
     "student debt. Calls for fully funding public schools to close the gap with private schools. "
     "Supports free early childhood education for all children from age 3."),

    ("Greens", "cost_of_living",
     "Proposes capping grocery prices at major supermarkets and breaking up duopoly power in the retail "
     "sector. Advocates for free public transport in major cities and a government-owned energy "
     "retailer to provide cheaper electricity directly to households."),

    # ── National Party ───────────────────────────────────────────────────────
    ("Nationals", "housing",
     "Focuses on regional housing investment and building the infrastructure needed to support "
     "population growth in regional towns and cities. Supports planning reforms that make it easier "
     "to build new homes in rural and regional areas."),

    ("Nationals", "healthcare",
     "Advocates for more rural health services, incentives to attract doctors and nurses to regional "
     "areas, and the expansion of telehealth to reduce the need for country patients to travel to "
     "cities for medical consultations."),

    ("Nationals", "economy",
     "Strong advocates for the agriculture, mining, and resources sectors as pillars of the national "
     "economy. Supports regional infrastructure investment, water security for farmers, and policies "
     "that reduce the cost of doing business in regional Australia."),

    ("Nationals", "climate",
     "Supports practical emissions reduction that does not disadvantage regional industries or "
     "farming communities. Advocates for supporting farmers through any energy transition and opposes "
     "policies that would increase costs or restrict agricultural production."),

    ("Nationals", "defence",
     "Strong supporter of the Australian Defence Force and veterans' services. Advocates for defence "
     "facilities in regional areas and ensuring rural and regional Australians can access defence "
     "industry employment opportunities."),

    ("Nationals", "immigration",
     "Supports skilled migration programs that direct workers to regional areas where labour shortages "
     "are most acute. Backs agricultural visa programs to ensure farmers can access seasonal workers "
     "during harvest periods."),

    ("Nationals", "education",
     "Advocates for properly funding regional universities and boarding schools. Supports vocational "
     "education and training pathways, particularly in agriculture, mining, and trades. Backs "
     "agricultural education programs at secondary and tertiary level."),

    ("Nationals", "cost_of_living",
     "Focused on reducing fuel costs for regional families who rely on cars and trucks far more than "
     "city residents. Supports freight and transport subsidies to reduce the price premium that "
     "regional consumers pay for groceries and goods."),

    # ── One Nation ───────────────────────────────────────────────────────────
    ("One Nation", "housing",
     "Advocates for reducing immigration as a means to ease housing demand. Supports cutting "
     "government red tape and stamp duty to make housing more affordable for first home buyers."),

    ("One Nation", "healthcare",
     "Opposes mandatory vaccination policies and advocates for patient choice in medical treatment. "
     "Supports strengthening regional health services and reducing waiting times in the public system."),

    ("One Nation", "economy",
     "Advocates for economic nationalism, including protecting Australian industries from foreign "
     "competition through tariffs. Opposes free trade agreements that it argues cost Australian jobs "
     "and supports reindustrialising the Australian economy."),

    ("One Nation", "climate",
     "Sceptical of mainstream climate science and strongly opposes carbon taxes, emissions trading "
     "schemes, and net zero targets. Advocates for the continued use of coal and fossil fuels and "
     "opposes subsidies for renewable energy."),

    ("One Nation", "defence",
     "Advocates for a strong, independent Australian defence capability and is cautious about "
     "over-reliance on alliances like AUKUS. Supports strong border protection and opposes "
     "foreign military bases on Australian soil."),

    ("One Nation", "immigration",
     "Advocates for significantly reduced immigration levels, including cutting the annual migrant "
     "intake and tightening visa requirements. Opposes multiculturalism policies and wants stricter "
     "criteria for refugee and asylum seeker processing."),

    ("One Nation", "education",
     "Advocates for a return to traditional curriculum focused on literacy, numeracy, and Australian "
     "history. Opposes progressive and ideological content in schools and supports greater parental "
     "control over what is taught."),

    ("One Nation", "cost_of_living",
     "Blames immigration levels for driving up rents and the cost of living. Advocates for reducing "
     "fuel excise taxes to lower costs for ordinary Australians and opposes green energy mandates "
     "that it argues raise electricity prices."),
]


def main() -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        log.error("Missing SUPABASE_URL / SUPABASE_KEY")
        sys.exit(1)

    db = create_client(url, key)

    # Build party lookup
    parties = db.table("parties").select("id,name,short_name").execute().data or []
    party_map: dict[str, str] = {}
    for p in parties:
        sn = (p.get("short_name") or "").strip()
        nm = (p.get("name") or "").strip()
        if sn:
            party_map[sn] = p["id"]
        if nm:
            party_map[nm] = p["id"]

    inserted = 0
    skipped = 0
    for short_name, category, summary in POLICIES:
        party_id = party_map.get(short_name)
        if not party_id:
            log.warning("Party not found: %r", short_name)
            skipped += 1
            continue
        db.table("party_policies").upsert(
            {"party_id": party_id, "category": category, "summary_plain": summary},
            on_conflict="party_id,category",
        ).execute()
        inserted += 1

    log.info("Done. %d policies upserted, %d skipped.", inserted, skipped)


if __name__ == "__main__":
    main()
