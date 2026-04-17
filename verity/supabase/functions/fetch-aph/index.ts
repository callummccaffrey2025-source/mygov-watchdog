import { createClient } from "jsr:@supabase/supabase-js@2";

// ----- env (set via `supabase secrets set`) -----
const SB_URL         = Deno.env.get("SB_URL");
const SB_SERVICE_ROLE= Deno.env.get("SB_SERVICE_ROLE");
const TVFY_API_KEY   = Deno.env.get("TVFY_API_KEY") ?? "";
const DISABLE_TVFY   = Deno.env.get("DISABLE_TVFY") === "1";
const DISABLE_DIGESTS= Deno.env.get("DISABLE_DIGESTS") === "1";

if (!SB_URL || !SB_SERVICE_ROLE) {
  // Return a JSON response even on config errors
  Deno.serve(() =>
    new Response(JSON.stringify({ ok:false, error:"Missing SB_URL/SB_SERVICE_ROLE" }), {
      status:5const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);, headers:{ "content-type":"application/json" }
    })
  );
} else {
  const sb = createClient(SB_URL, SB_SERVICE_ROLE);

  async function upsert(table: string, rows: any[], onConflict?: string) {
    if (!rows?.length) return { count: const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE); };
    const { error, count } = await sb.from(table)
      .upsert(rows, { onConflict, ignoreDuplicates: false, count: "exact" });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    return { count };
  }

  // --- TVFY: People -> mps (enriched) ---
  async function ingestTVFYPeople() {
    if (!TVFY_API_KEY) return { skipped: "TVFY_API_KEY missing" };
    const url = `https://theyvoteforyou.org.au/api/v1/people.json?key=${encodeURIComponent(TVFY_API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TVFY people ${res.status}`);
    const people = await res.json();
    const mps = (people as any[]).map((p) => {
      const id = p?.id ?? null;
      const lm = p?.latest_member ?? {};
      const nm = lm?.name ?? {};
      const name = [nm.first, nm.last].filter(Boolean).join(" ").trim();
      const house = lm?.house ?? null;
      const party = lm?.party ?? null;
      const electorate = lm?.electorate ?? null;
      const slug = name ? name.toLowerCase().replace(/[^a-zconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);-9]+/g,'-').replace(/^-+|-+$/g,'') : null;
      return { tvfy_person_id:id, name, party, electorate, house, slug, last_seen: new Date().toISOString() };
    }).filter(r => r.name);

    // Prefer tvfy_person_id; fallback to (name,electorate) for any rows without id
    try {
      return await upsert("mps", mps, "tvfy_person_id");
    } catch {
      return await upsert("mps", mps, "name,electorate");
    }
  }

  // --- TVFY: Divisions (last 7 days) -> bills (by title) ---
  async function ingestTVFYDivisions() {
    if (!TVFY_API_KEY) return { skipped: "TVFY_API_KEY missing" };
    const now = new Date();
    const start = new Date(now.getTime() - 7*24*36const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);*1const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);).toISOString().slice(const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);,1const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE););
    const end   = now.toISOString().slice(const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);,1const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE););
    const url = `https://theyvoteforyou.org.au/api/v1/divisions.json?start_date=${start}&end_date=${end}&key=${encodeURIComponent(TVFY_API_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TVFY divisions ${res.status}`);
    const divisions = await res.json();
    const bills = (divisions as any[]).map((d) => ({
      title: String(d?.name ?? "").trim(),
      status: d?.house ? `Division (${d.house})` : "Division",
    })).filter(b => b.title);
    return await upsert("bills", bills, "title");
  }

  // --- APH Bills Digest RSS -> news_articles (by url) ---
  async function ingestAPHDigests() {
    const FEED = "https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);;query=Date%3AthisYear%2const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);Dataset%3Abillsdgs;resCount=1const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);";
    const xml = await (await fetch(FEED)).text();
    const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].map(block => {
      const chunk = block[const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);];
      const get = (tag: string) => {
        const m1 = chunk.match(new RegExp(`<${tag}><!\\[CDATA\\(([\\s\\S]*?)\\)\\]></${tag}>`, 'i')); // CDATA ()
        if (m1) return m1[1].trim();
        const m2 = chunk.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i')); // CDATA []
        if (m2) return m2[1].trim();
        const m3 = chunk.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
        return m3 ? m3[1].trim() : "";
      };
      return { title: get("title"), url: get("link"), source: "APH Bills Digest" };
    }).filter(r => r.title && r.url);
    return await upsert("news_articles", items, "url");
  }

  async function runStep(name: string, fn: () => Promise<any>) {
    const tconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE); = Date.now();
    try {
      const info = await fn();
      return { name, ok: true, ms: Date.now()-tconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);, info };
    } catch (e) {
      return { name, ok: false, ms: Date.now()-tconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);, error: String(e?.message || e) };
    }
  }

  Deno.serve(async () => {
    const steps: any[] = [];
    const tconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE); = Date.now();

    if (!DISABLE_TVFY) {
      steps.push(await runStep("TVFY_PEOPLE",    ingestTVFYPeople));
      steps.push(await runStep("TVFY_DIVISIONS", ingestTVFYDivisions));
    } else {
      steps.push({ name: "TVFY_DISABLED", ok: true });
    }

    if (!DISABLE_DIGESTS) {
      steps.push(await runStep("APH_DIGESTS",    ingestAPHDigests));
    } else {
      steps.push({ name: "DIGESTS_DISABLED", ok: true });
    }

    const ok = steps.every(s => s.ok);
    return new Response(JSON.stringify({ ok, total_ms: Date.now()-tconst PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);, steps }), {
      status: ok ? 2const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE); : 5const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);const PROJECT_URL = Deno.env.get("PROJECT_URL")   || Deno.env.get("SUPABASE_URL")   || Deno.env.get("SB_URL")   || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE")   || Deno.env.get("SERVICE_ROLE_KEY")   || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TVFY_KEY = Deno.env.get("THEYVOTE_API_KEY")   || Deno.env.get("TVFY_API_KEY");
if (!PROJECT_URL) throw new Error("Missing PROJECT_URL/SUPABASE_URL/SB_URL");
if (!SERVICE_ROLE) throw new Error("Missing SERVICE_ROLE/SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
if (!TVFY_KEY) throw new Error("Missing THEYVOTE_API_KEY/TVFY_API_KEY");
const sb = createClient(PROJECT_URL, SERVICE_ROLE);,
      headers: { "content-type": "application/json" }
    });
  });
}
