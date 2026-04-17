import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
export async function POST(){
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ sessionId: "demo_session", authed: !!user });
}
