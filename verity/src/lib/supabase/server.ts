import { createClient as _createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Return a server-side Supabase client (no session persistence). */
export function supabaseServer() {
  if (!url || !anonKey) throw new Error("Supabase env vars missing");
  return _createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application": "verity-app" } },
  });
}

/** Compatibility: some code imports { createClient } from this module. */
export function createClient() {
  return supabaseServer();
}
