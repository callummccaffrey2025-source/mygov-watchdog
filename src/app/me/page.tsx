'use client';
import { useEffect, useState } from "react";
type User = { id: string; email?: string | null };
export default function MePage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient").catch(() => ({ supabase: null as any }));
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          if (mounted) setUser((data as any)?.user ?? null);
          supabase.auth.onAuthStateChange((_evt, session) => mounted && setUser((session as any)?.user ?? null));
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {!user ? (
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="text-lg font-medium mb-2">Sign in to Verity (Preview)</div>
          <p className="text-white/70 mb-6 text-sm">This is a mock sign-in. Click below to simulate.</p>
          <button onClick={()=>setUser({ id: "preview", email: "you@preview" })} className="w-full rounded-md bg-white text-black px-4 py-3 font-medium hover:bg-white/90">Continue</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xl">Welcome back<span className="text-white/60"> — {user.email ?? "preview user"}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">Account area stub. Add billing, API keys, alerts, and sessions here.</div>
          <button onClick={()=>setUser(null)} className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/5">Sign out</button>
        </div>
      )}
    </div>
  );
}
