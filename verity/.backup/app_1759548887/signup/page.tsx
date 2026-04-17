"use client";
declare global { interface Window { plausible?: (e:string, o?:any)=>void } }
import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      window.plausible && window.plausible('signup_start');
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/" }),
      });
      const j = await res.json();
      if (j?.ok) { setSent(true); window.plausible && window.plausible('signup_success'); }
      else setError(j?.error || "Could not send link");
    } catch (err:any) {
      setError("Network error");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold text-emerald-300">Start free</h1>
        <p className="mt-2 text-zinc-400">We’ll email you a secure link to sign in.</p>
        {sent ? (
          <div className="mt-6 rounded-xl border border-zinc-800 p-4 text-emerald-300">
            Check your email for a magic link.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex gap-2">
            <input
              type="email" required
              value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              aria-label="Email for bill alerts"
            />
            <button
              type="submit" disabled={loading}
              className={`rounded-xl px-4 py-2 text-sm ring-1 transition ${
                loading ? "cursor-not-allowed text-zinc-600 ring-zinc-800"
                        : "text-emerald-300 ring-emerald-700 hover:ring-emerald-600/40"
              }`}
            >
              {loading ? "Sending…" : "Get link"}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-6 text-sm text-zinc-500">
          By continuing you agree to our <Link href="/terms" className="text-emerald-300">Terms</Link>.
        </p>
      </div>
    </main>
  );
}
