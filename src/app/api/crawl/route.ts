// src/app/api/crawl/route.ts
export const runtime = "nodejs"; // Ensure Node runtime on Vercel

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
    const { data, error } = await supabaseAdmin
      .from("source")
      .upsert(parsed, { onConflict: "url" })
      .select("id, name, url, jurisdiction, type")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Insert/Upsert failed" }, { status: 400 });
    }
    return NextResponse.json({ id: data.id, source: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 400 });
  }
}
