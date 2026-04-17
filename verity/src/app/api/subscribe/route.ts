// src/app/api/subscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type Body = { email?: string; name?: string; ref?: string };

function okEmail(e?: string) {
  return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "POST { email, name?, ref? } to join the waitlist.",
  });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;
  const ref = body.ref?.trim() || null;

  if (!okEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Prefer Supabase if configured
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("waitlist")
      .upsert({ email, name, ref }, { onConflict: "email" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, stored: "supabase", data });
  }

  // Fallback: append to local file (great for dev)
  try {
    const dir = path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    const line =
      JSON.stringify({ email, name, ref, at: new Date().toISOString() }) + "\n";
    await fs.appendFile(path.join(dir, "waitlist.jsonl"), line, "utf8");
    return NextResponse.json({ ok: true, stored: "file" });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
