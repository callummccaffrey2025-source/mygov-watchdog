import { createServerClient, type CookieOptions } from "@supabase/ssr";
/** Minimal server client with no-op cookie store (avoids Next typing mismatch).
 *  Replace with cookies() integration when auth/session wiring is finalized. */
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anon, {
    cookies: {
      get(_name: string){ return undefined; },
      set(_name: string, _value: string, _opts: CookieOptions){},
      remove(_name: string, _opts: CookieOptions){},
    },
  });
}

// Back-compat alias for legacy imports
export const createClient = getSupabaseServer;
