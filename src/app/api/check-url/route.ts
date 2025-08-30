export const dynamic = 'force-dynamic';
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

const MIRROR_PREFIX = process.env.MIRROR_PREFIX?.trim() || "https://r.jina.ai/http://";

function toMirror(u: string) {
  const url = new URL(u);
  // jina.ai expects "http://" in the path
  return MIRROR_PREFIX + url.host + url.pathname + (url.search || "");
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    // Best-effort HEAD check from the server (never from the browser)
    let status = 0;
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "manual" });
      status = res.status;
    } catch {
      // network error or TLS issue — treat as blocked
      status = 0;
    }

    const blocked = status === 403 || status === 406 || status === 451 || status === 0;
    return NextResponse.json({ ok: !blocked, status, mirror: blocked ? toMirror(url) : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
