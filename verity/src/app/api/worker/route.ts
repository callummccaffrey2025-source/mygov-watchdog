export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { JSDOM } from "jsdom";

async function fetchHtml(url: string){ const res = await fetch(url); return await res.text(); }

export async function POST(req: Request) {
  const { source_id, url, jurisdiction="AU", title=null, published_at=null } = await req.json();
  if(!url || !source_id) return NextResponse.json({ error:"source_id and url required"}, {status:400});
  const html = await fetchHtml(url);
  const dom = new JSDOM(html);
  const content = dom.window.document.body.textContent?.trim().slice(0, 500000) || "";
  const { data, error } = await db.from("document").upsert({
    source_id, jurisdiction, title: title || (dom.window.document.title || url),
    url, content, published_at
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, doc_id: data.id });
}
