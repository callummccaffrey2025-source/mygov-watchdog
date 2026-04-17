// src/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;

if (!url || !serviceKey) {
  // Keep errors obvious during dev
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. " +
      "The /api/waitlist route will return 500 until you set .env.local."
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
