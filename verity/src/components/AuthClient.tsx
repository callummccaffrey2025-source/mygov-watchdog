"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
export default function AuthClient() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return (
    <Auth
      supabaseClient={getSupabaseBrowser()}
      appearance={{ theme: ThemeSupa }}
      redirectTo={site ? site + "/auth/callback" : undefined}
      magicLink
      providers={[]}
    />
  );
}
