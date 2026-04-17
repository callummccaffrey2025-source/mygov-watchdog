import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

type TipBody = {
  text?: string;
  message?: string;
  jurisdiction?: string | null;
  contact?: string | null;
  url?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<TipBody>;
    const payload = (body.text ?? body.message ?? "").trim();

    if (!payload) {
      return NextResponse.json({ ok: false, error: "text or message required" }, { status: 400 });
    }
    if (payload.length < 10) {
      return NextResponse.json({ ok: false, error: "tip is too short" }, { status: 400 });
    }

    const supa = supabaseAdmin();
    const { data, error } = await supa
      .from("tips")
      .insert({
        text: payload,
        jurisdiction: body.jurisdiction ?? null,
        contact: body.contact ?? null,
        url: body.url ?? null,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
