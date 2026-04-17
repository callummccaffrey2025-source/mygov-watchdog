import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { MPS } from "@/app/_mock/mps";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (env.USE_MOCK || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return NextResponse.json({ items: MPS, count: MPS.length });
    }
    const supa = createClient();
    const { data, error } = await supa.from("mps").select("*").order("name");
    if (error) throw error;
    return NextResponse.json({ items: data ?? [], count: data?.length ?? 0 });
  } catch (e) {
    // fallback so the UI never goes blank in dev
    return NextResponse.json({ items: MPS, count: MPS.length, fallback: true });
  }
}
