import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { envPublic } from "./env.public";

export function supabaseServer() {
  if (!envPublic.NEXT_PUBLIC_SUPABASE_URL || !envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars missing (server).");
  }
  const store = cookies();
  return createServerClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) { return store.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { store.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { store.set({ name, value: "", expires: new Date(0), ...options }); }
      }
    }
  );
}
