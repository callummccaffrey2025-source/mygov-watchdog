import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function getServerSupabase(){
  const c = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name){ return c.get(name)?.value; },
      set(){}, remove(){}
    }
  });
}
