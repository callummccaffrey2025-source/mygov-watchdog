import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function sbServer() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n)=>c.get(n)?.value, set(){}, remove(){} } }
  );
}
