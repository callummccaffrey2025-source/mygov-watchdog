// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SR  = process.env.SUPABASE_SERVICE_ROLE?.trim();

if (!URL) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!SR)  throw new Error("Missing SUPABASE_SERVICE_ROLE (server-only)");

export const supabaseAdmin = createClient(URL, SR, {
  auth: { persistSession: false },
});

// Back-compat alias for older imports
export const supaAdmin = supabaseAdmin;
