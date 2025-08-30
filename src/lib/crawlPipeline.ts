import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UA = "VerityBot/1.0 (+https://verity.run)";

const ENV_HOST_ALLOW = new Set(
  (process.env.VERITY_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const ENV_HOST_DENY = new Set(
  (process.env.VERITY_BLOCKED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export function hostAllowed(raw: string): boolean {
  try {
    const h = new URL(raw).hostname.replace(/^www\./, "");
    // denylist first
    for (const d of ENV_HOST_DENY) {
      if (h === d || h.endsWith("." + d)) return false;
    }
    // allow all if no allowlist provided
    if (ENV_HOST_ALLOW.size === 0) return true;
    // allow if matches allowlist
    for (const a of ENV_HOST_ALLOW) {
      if (h === a || h.endsWith("." + a)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Index a single page (called by the crawl worker).
 * Keep it simple so the build passes; you can expand parsing later.
 */
export async function indexPage(job: { id: string; url: string; source_id: string }) {
  if (!hostAllowed(job.url)) {
    const e: any = new Error("host not allowed");
    e.retryable = false;
    throw e;
  }

  const headers: Record<string, string> = {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml",
  };

  const res = await fetch(job.url, { headers });
  if (res.status === 304) return;
  if (res.status < 200 || res.status >= 400) {
    const e: any = new Error(`http ${res.status}`);
    e.retryable = res.status >= 500;
    throw e;
  }

  const html = await res.text();
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? job.url).trim();

  await supabaseAdmin
    .from("document")
    .upsert(
      {
        url: job.url,
        source_id: job.source_id,
        title,
        content: html.slice(0, 10000),
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "url" }
    );
}
