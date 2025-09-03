import { createBrowserClient } from "@supabase/ssr";
import { envPublic } from "./env.public";

export function supabaseBrowser() {
  if (!envPublic.NEXT_PUBLIC_SUPABASE_URL || !envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars missing (client).");
  }
  return createBrowserClient(
    envPublic.NEXT_PUBLIC_SUPABASE_URL,
    envPublic.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
