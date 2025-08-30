export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { JSDOM } from "jsdom";

async function fetchHtml(url: string){ const r = await fetch(url, { redirect: "follow" }); return await r.text(); }

export async function POST(req: Request) {
  const { source_id, url, jurisdiction="AU", title=null, published_at=null } = await req.json();
  if(!url || !source_id) return NextResponse.json({ error:"source_id and url required"}, {status:400});

  const html = await fetchHtml(url);
  const dom = new JSDOM(html);
  const content = dom.window.document.body?.textContent?.trim().slice(0, 300000) || "";

  const { data: doc, error } = await db.from("document").upsert({
    source_id, jurisdiction, title: title || (dom.window.document.title || url),
    url, content, published_at
  }).select("id,content").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget embed step (no await)
  fetch(new URL("/api/embed", process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000").toString(),
    { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ doc_id: doc.id }) }
  ).catch(()=>{});

  return NextResponse.json({ ok:true, doc_id: doc.id });
}
