import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";

// ---------- helpers ----------
const norm = (s:string) => (s||"").trim().replace(/\s+/g," ");
const slug = (s:string) => norm(s).toLowerCase()
  .replace(/^division of\s+/i,"")
  .replace(/[^\p{L}\p{N}]+/gu,"-")
  .replace(/^-+|-+$/g,"");

const PARTY_MAP: Record<string,string> = {
  "australian labor party":"ALP","labor":"ALP","alp":"ALP",
  "liberal":"LP","liberal party":"LP","lp":"LP",
  "lnp":"LNP","liberal national party":"LNP",
  "nationals":"NATS","the nationals":"NATS","national":"NATS","nats":"NATS",
  "greens":"GRN","australian greens":"GRN","grn":"GRN",
  "independent":"IND","ind":"IND"
};
const partyNorm = (p:string) => PARTY_MAP[(p||"").toLowerCase()] || (p||"");

const pick = (r:any, ...keys:string[]) =>
  keys.map(k => r?.[k]).find(v => v != null && String(v).trim() !== "") || "";

// more tolerant CSV loader (BOM, CRLF/CR, odd quoting)
function load(path: string) {
  let raw = require("fs").readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);          // strip BOM
  raw = raw.replace(/\r\n?/g, "\n");                              // normalise EOL

  const first = raw.split("\n").find(l => l.trim()) || "";
  const cnt = (ch:string) => (first.match(new RegExp(ch,"g"))||[]).length;
  const delimiter = cnt("\t")>cnt(",") && cnt("\t")>cnt(";") ? "\t" : (cnt(";")>cnt(",") ? ";" : ",");

  return parse(raw, {
    columns: (h:string[]) => h.map(x => String(x).replace(/\ufeff/g,"").toLowerCase().trim().replace(/\s+/g,"_")),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true
  });
}

const nameFrom = (r:any) => {
  const first = pick(r,"preferred_name","first_name","given_names");
  const sur   = pick(r,"surname","family_name","last_name");
  return norm([first,sur].filter(Boolean).join(" "));
};
const electOf = (r:any) => norm(pick(r,"electorate","division","seat"));
const stateOf = (r:any) => norm(pick(r,"state","state_territory"));

// ---------- main ----------
(async function main() {
  const H_name   = load("scripts/raw/aph-members-byname.csv");
  const H_state  = load("scripts/raw/aph-members-bystate.csv");
  const H_party  = load("scripts/raw/aph-members-byparty.csv");
  const H_gender = load("scripts/raw/aph-members-bygender.csv");
  const SEN      = load("scripts/raw/aph-senators.csv");

  // Build House by grouping ALL rows by electorate (151 unique)
  const buckets: Record<string, any[]> = {};
  for (const r of [...H_state, ...H_party, ...H_name, ...H_gender]) {
    const elect = electOf(r); if (!elect) continue;
    const key = slug(elect);
    (buckets[key] ||= []).push(r);
  }

  function score(r:any) {
    return ["preferred_name","first_name","surname","political_party","party","email","phone","website","portrait_url"].reduce((a,k)=>a+(pick(r,k)?1:0),0);
  }
  function mergeGroup(arr:any[]) {
    // choose best row; then fill gaps from others
    arr.sort((a,b)=>score(b)-score(a));
    const best = arr[0] || {};
    const out:any = {
      name: nameFrom(best) || nameFrom(arr.find(x=>nameFrom(x))),
      electorate: electOf(best) || electOf(arr.find(x=>electOf(x))),
      party: partyNorm(pick(best,"political_party","party")) || partyNorm(pick(arr.find(x=>pick(x,"political_party","party"))||{},"political_party","party")),
      portrait_url: pick(best,"portrait_url"),
      email: pick(best,"email"),
      phone: pick(best,"phone"),
      website: pick(best,"website"),
      twitter: pick(best,"twitter"),
      attendance_overall: pick(best,"attendance_overall"),
      attendance_12m: pick(best,"attendance_12m"),
    };
    return out;
  }

  let house = Object.values(buckets).map(mergeGroup).filter(r => r.name && r.electorate);
  if (house.length !== 151) console.warn(`⚠ House electorates=${house.length} (expected 151)`);

  // Senate: unique by name
  const senMap = new Map<string, any>();
  for (const r of SEN) {
    const name = nameFrom(r); if (!name) continue;
    const k = slug(name);
    if (!senMap.has(k)) senMap.set(k, {
      name,
      party: partyNorm(pick(r,"political_party","party")),
      state: stateOf(r),
      portrait_url: pick(r,"portrait_url"),
      email: pick(r,"email"),
      phone: pick(r,"phone"),
      website: pick(r,"website"),
      twitter: pick(r,"twitter"),
      attendance_overall: pick(r,"attendance_overall"),
      attendance_12m: pick(r,"attendance_12m"),
    });
  }
  const senate = Array.from(senMap.values());
  if (senate.length !== 76) console.warn(`⚠ Senate count=${senate.length} (expected 76)`);

  // Write normalized inputs
  await fs.mkdir("scripts/input", { recursive: true });
  const mpsCsv = [
    "name,party,electorate,portrait_url,email,phone,website,twitter,attendance_overall,attendance_12m",
    ...house.map(r => `"${r.name}","${r.party||""}","${r.electorate||""}","${r.portrait_url||""}","${r.email||""}","${r.phone||""}","${r.website||""}","${r.twitter||""}","${r.attendance_overall||""}","${r.attendance_12m||""}"`)
  ].join("\n");
  const sensCsv = [
    "name,party,state,portrait_url,email,phone,website,twitter,attendance_overall,attendance_12m",
    ...senate.map(r => `"${r.name}","${r.party||""}","${r.state||""}","${r.portrait_url||""}","${r.email||""}","${r.phone||""}","${r.website||""}","${r.twitter||""}","${r.attendance_overall||""}","${r.attendance_12m||""}"`)
  ].join("\n");

  await fs.writeFile("scripts/input/mps.csv", mpsCsv, "utf8");
  await fs.writeFile("scripts/input/senators.csv", sensCsv, "utf8");
  console.log(`Wrote House=${house.length}, Senate=${senate.length} → scripts/input/*.csv`);
})();
