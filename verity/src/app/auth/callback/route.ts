import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const supabase = getSupabaseServer();
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  if (code) await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${origin}/account`);
}
