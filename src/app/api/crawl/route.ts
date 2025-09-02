// src/app/api/crawl/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const J_ALLOWED = new Set(["AU","ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]);
const T_ALLOWED = new Set([
  "generic","parliament","federal","state","territory","court","gazette","agency","news","ngo","party"
]);

function parse(body: any) {
  if (!body || typeof body !== "object") throw new Error("Invalid JSON body");
  const { name, url, jurisdiction, type } = body;
  if (!name || !url || !jurisdiction) throw new Error("name, url, jurisdiction are required");
  try { new URL(url); } catch { throw new Error("url must be a valid URL"); }
  const j = String(jurisdiction).trim().toUpperCase();
  if (!J_ALLOWED.has(j)) throw new Error(`jurisdiction must be one of: ${[...J_ALLOWED].join(", ")}`);
  let t = String(type ?? "").trim().toLowerCase();
  if (!t) t = url.toLowerCase().includes("aph.gov.au") || String(name).toLowerCase().includes("parliament") ? "parliament" : "generic";
  if (!T_ALLOWED.has(t)) throw new Error(`type must be one of: ${[...T_ALLOWED].join(", ")}`);
  return { name: String(name), url: String(url), jurisdiction: j, type: t };
}

export async function GET() {
  return NextResponse.json({ ok: true, at: "/api/crawl" });
}

export async function POST(req: Request) {
  try {
    const parsed = parse(await req.json());

    // 1) Upsert source by URL, return its id
    const { data: src, error: srcErr } = await supabaseAdmin
      .from("source")
      .upsert(
        {
          name: parsed.name,
          url: parsed.url,
          jurisdiction: parsed.jurisdiction,
          type: parsed.type
        },
        { onConflict: "url" }
      )
      .select("id,name,url,jurisdiction,type")
      .single();

    if (srcErr || !src)
      return NextResponse.json({ error: srcErr?.message || "Upsert source failed" }, { status: 400 });

    // 2) Insert crawl job with explicit source_id (trigger is backup)
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("crawl_job")
      .insert({
        source_id: src.id,
        url: parsed.url,
        name: parsed.name,
        jurisdiction: parsed.jurisdiction,
        type: parsed.type,
        status: "new"
      })
      .select("id,source_id,status,created_at")
      .single();

    if (jobErr)
      return NextResponse.json({ error: jobErr.message }, { status: 400 });

    return NextResponse.json({ source: src, job });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 400 });
  }
}
