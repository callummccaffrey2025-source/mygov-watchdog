import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error('Supabase admin env vars missing: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'verity-admin' } }
  });
  return adminClient;
}


// Compat named export for legacy imports
export const supabaseAdmin = getSupabaseAdmin();
