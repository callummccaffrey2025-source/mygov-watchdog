import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { BILLS } from "@/app/_mock/bills";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (env.USE_MOCK || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return NextResponse.json({ items: BILLS, count: BILLS.length });
    }
    const supa = createClient();
    const { data, error } = await supa
      .from("bills")
      .select("*")
      .order("introduced", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [], count: data?.length ?? 0 });
  } catch {
    return NextResponse.json({ items: BILLS, count: BILLS.length, fallback: true });
  }
}
