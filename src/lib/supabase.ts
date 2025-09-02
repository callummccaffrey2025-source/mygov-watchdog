import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabaseBrowser = () =>
  createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabaseServer = () =>
  createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
