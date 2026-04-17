import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import slugifyLib from "slugify";

type MP = {
  slug: string;
  name: string;
  party: string;
  chamber: "House" | "Senate";
  electorate?: string;
  state?: string;
  portraitUrl?: string;
  contact?: { email?: string; phone?: string; website?: string; twitter?: string };
  attendanceOverall?: number | null;
  attendance12m?: number | null;
  rebellions12m?: number;
  committees: Array<{ name: string; role: "Chair" | "Member"; attendancePct?: number }>;
  votes: Array<any>;
  speeches: Array<any>;
  donations?: Array<{ amount: number; source?: string; date?: string; receipts?: any[] }>;
  signals: Array<any>;
  interestsUrl?: string;
  roles?: string;
};

function autodelim(sample: string) {
  const first = sample.split(/\r?\n/).find(l => l.trim()) || "";
  return first.includes("\t") ? "\t" : (first.includes(";") ? ";" : ",");
}
function normaliseHeaders(hs: string[]) {
  return hs.map(h => h.toLowerCase().trim().replace(/\s+/g, "_"));
}
function loadCSV(p: string) {
  if (!fss.existsSync(p)) return [] as any[];
  const raw = fss.readFileSync(p, "utf8");
  const delimiter = autodelim(raw);
  return parse(raw, { columns: normaliseHeaders, delimiter, skip_empty_lines: true, trim: true });
}
function slugify(s: string) {
  return slugifyLib(s, { lower: true, strict: true }).replace(/_+/g, "-");
}
function normParty(party: string) {
  const p = (party || "").toLowerCase();
  if (p.startsWith("australian labor")) return "Labor";
  if (p.startsWith("liberal")) return "Liberal";
  if (p.startsWith("national")) return "National";
  if (p.includes("greens")) return "Greens";
  if (p.includes("independent")) return "Independent";
  return party || "Other";
}
function fullName(r: any) {
  // Prefer a single "name" field if present, else stitch preferred/first + surname
  const stitched =
    (r.preferred_name ? `${r.preferred_name} ${r.surname || r.last_name || ""}` :
     `${r.first_name || ""} ${r.surname || r.last_name || ""}`) as string;
  const name = (r.name || stitched || "").trim().replace(/\s+/g, " ");
  return name;
}

async function main() {
  const base = "scripts/input";
  const house = loadCSV(path.join(base, "mps.csv"));
  const senate = loadCSV(path.join(base, "senators.csv"));

  const mps: MP[] = [];

  // House (151)
  for (const r of house) {
    const name = fullName(r);
    if (!name) continue;
    const electorate = r.electorate || r.division || r.seat || "";
    const party = normParty(r.political_party || r.party || "");
    mps.push({
      slug: slugify(name),
      name,
      party,
      chamber: "House",
      electorate,
      portraitUrl: r.portrait_url || "",
      contact: { email: r.email, phone: r.phone, website: r.website, twitter: r.twitter },
      attendanceOverall: r.attendance_overall ? Number(r.attendance_overall) : null,
      attendance12m: r.attendance_12m ? Number(r.attendance_12m) : null,
      rebellions12m: 0,
      committees: [],
      votes: [],
      speeches: [],
      donations: [],
      signals: [],
      roles: electorate ? `Member for ${electorate}` : "MP",
    });
  }

  // Senate (76)
  for (const r of senate) {
    const name = fullName(r);
    if (!name) continue;
    const state = r.state || r.state_territory || "";
    const party = normParty(r.political_party || r.party || "");
    mps.push({
      slug: slugify(name),
      name,
      party,
      chamber: "Senate",
      state,
      portraitUrl: r.portrait_url || "",
      contact: { email: r.email, phone: r.phone, website: r.website, twitter: r.twitter },
      attendanceOverall: r.attendance_overall ? Number(r.attendance_overall) : null,
      attendance12m: r.attendance_12m ? Number(r.attendance_12m) : null,
      rebellions12m: 0,
      committees: [],
      votes: [],
      speeches: [],
      donations: [],
      signals: [],
      roles: "Senator",
    });
  }

  const allowPartial = process.argv.includes("--allow-partial");
  const houseCount = mps.filter(m => m.chamber === "House").length;
  const senateCount = mps.filter(m => m.chamber === "Senate").length;
  if (!allowPartial) {
    if (houseCount !== 150) throw new Error(`House count ${houseCount} != 150`);
    if (senateCount < 75 || senateCount > 76) throw new Error(`Senate count ${senateCount} not in [75,76]`);
  // allow a temporary vacancy
  if (!allowPartial) {
    if (senateCount < 75 || senateCount > 76) throw new Error(`Senate count ${senateCount} not in [75,76]`);
  }
  } else {
    console.warn(`⚠️ Partial dataset: House=${houseCount}, Senate=${senateCount}`);
  }

  // Deduplicate by slug
  const seen = new Set<string>();
  const deduped: MP[] = [];
  for (const m of mps) { if (seen.has(m.slug)) continue; seen.add(m.slug); deduped.push(m); }

  await fs.mkdir(path.join("public","data"), { recursive: true });
  await fs.writeFile(path.join("public","data","mps-au.json"), JSON.stringify(deduped, null, 2));
  console.log(`✅ Wrote ${deduped.length} MPs → public/data/mps-au.json`);
  console.log("e.g.", deduped.slice(0,6).map(x=>x.slug).join(", "));
}
main().catch(e => { console.error("❌ Ingest failed:", e.message); process.exit(1); });
