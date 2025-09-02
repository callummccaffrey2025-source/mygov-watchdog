"use client";
import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

export function getSupabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) {
    console.warn("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anon);
}

// Back-compat: some files import { supabaseBrowser }
export const supabaseBrowser = getSupabaseBrowser;

// Optional default import compatibility
export default getSupabaseBrowser;
