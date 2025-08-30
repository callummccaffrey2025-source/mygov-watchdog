import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export async function getServerSupabase(){
  const c = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n)=>c.get(n)?.value, set:()=>{}, remove:()=>{} } }
  );
}
