/**
 * Minimal crawler edge function:
 * - claims one crawl_job
 * - fetches URL if host allowed
 * - inserts/updates document
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ALLOWED = (Deno.env.get("VERITY_ALLOWED_HOSTS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function hostAllowed(u: string) {
  try {
    const h = new URL(u).host.toLowerCase();
    return ALLOWED.some(a => h.endsWith(a.toLowerCase()));
  } catch { return false; }
}

serve(async () => {
  // 1) claim a job
  const { data: job, error: claimErr } = await supa.rpc("claim_crawl_job");
  if (claimErr || !job) return new Response(JSON.stringify({ ok: true, claimed: 0 }), { headers: { "content-type": "application/json" }});

  const { id, url, source_id } = job;
  if (!hostAllowed(url)) {
    await supa.from("crawl_job").update({ status: "error", error: "host not allowed" }).eq("id", id);
    return Response.json({ ok: false, reason: "host not allowed", url });
  }

  // 2) fetch page
  const res = await fetch(url, { redirect: "follow" });
  const html = await res.text();

  // naive title extraction
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const title = m?.[1]?.trim() || url;

  // 3) upsert document
  const doc = {
    source_id,
    jurisdiction: "AU",
    title,
    url,
    content: html.replace(/\s+/g, " ").slice(0, 500000), // cap
    published_at: new Date().toISOString(),
  };

  const { error: insErr } = await supa
    .from("document")
    .upsert(doc, { onConflict: "url" });

  await supa.from("crawl_job").update({
    status: insErr ? "error" : "done",
    error: insErr?.message || null
  }).eq("id", id);

  return Response.json({ ok: !insErr, job_id: id, title, url });
});
