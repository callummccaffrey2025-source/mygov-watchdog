import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let _c: SupabaseClient | null = null;
function get() {
  if (_c) return _c;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _c = createClient(url, key, { auth: { persistSession: false } });
  return _c;
}
export const supaAdmin = new Proxy({} as SupabaseClient, { get(_t,p){ return (get() as any)[p]; }}) as SupabaseClient;
export const supabaseAdmin = supaAdmin;

export function getSupabaseAdmin(){ return supaAdmin; }
