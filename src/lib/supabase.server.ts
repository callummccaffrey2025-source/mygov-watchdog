import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY!;
if (!url || !key) {
  // Don't crash the app; routes will just skip logging
  console.warn('Supabase env missing: logging disabled');
}
export const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
