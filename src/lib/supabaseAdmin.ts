import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;


if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (check .env.local)");
if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (check .env.local)");

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export { supabaseAdmin as supaAdmin };
