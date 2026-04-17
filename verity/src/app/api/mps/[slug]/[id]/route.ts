import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { MPS } from "@/app/_mock/mps";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  try {
    if (env.USE_MOCK || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      const item = MPS.find(m => m.id === id);
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ item });
    }
    const supa = createClient();
    const { data, error } = await supa.from("mps").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (e) {
    const item = MPS.find(m => m.id === id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item, fallback: true });
  }
}
