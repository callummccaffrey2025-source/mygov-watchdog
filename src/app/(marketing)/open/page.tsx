"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export default function OpenPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/dashboard` }
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {!sent ? (
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <input className="w-full border rounded-lg px-3 py-2" type="email" required placeholder="you@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <button className="rounded-lg border px-3 py-2 w-full">Send magic link</button>
          {err && <p className="text-red-600">{err}</p>}
        </form>
      ) : (
        <p className="mt-6">Check your email for the sign-in link.</p>
      )}
    </div>
  );
}
