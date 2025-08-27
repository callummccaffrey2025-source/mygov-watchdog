// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE)
  throw new Error("Missing SUPABASE_SERVICE_ROLE (server-only)");

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } }
);

// Back-compat alias for older imports elsewhere in your app:
export const supaAdmin = supabaseAdmin;
