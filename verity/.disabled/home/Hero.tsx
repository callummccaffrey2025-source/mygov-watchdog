'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const ENABLE_PLAUSIBLE = process.env.NEXT_PUBLIC_ENABLE_PLAUSIBLE === '1';

export default function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trackCTA(placement: string) {
    if (!ENABLE_PLAUSIBLE) return;
    try {
      navigator.sendBeacon?.(
        '/api/analytics/cta',
        new Blob([JSON.stringify({ name: 'Start Free Click', url: window.location.href, props: { placement } })], { type: 'application/json' })
      );
    } catch {}
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'hero' }),
        cache: 'no-store',
      });
      if (!res.ok && res.status !== 204) throw new Error('Failed to capture email');
      await trackCTA('hero-form');
      router.push('/signup');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onStartFreeClick() {
    await trackCTA('hero-button');
    router.push('/signup');
  }

  return (
    <section id="start-free" className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-50">
          See what Parliament is doing—clearly, without the spin.
        </h1>
        <p className="mt-3 text-neutral-300">
          Verity turns bills, votes, and MPs’ records into plain-English summaries. Built for Australians who want
          signal over noise. Non-partisan. Privacy-minded.
        </p>
      </div>

      <ul className="mt-4 grid gap-2 text-sm text-neutral-300 sm:grid-cols-3">
        <li className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">• Track live bill movement</li>
        <li className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">• MP voting history at a glance</li>
        <li className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">• No ads. Cancel anytime.</li>
      </ul>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2">
          <input
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            aria-label="Email address"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-neutral-900 hover:bg-white disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Start free'}
          </button>
        </form>
        <button
          type="button"
          onClick={onStartFreeClick}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
        >
          Skip email → Sign up
        </button>
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <p className="mt-2 text-xs text-neutral-500">Free trial. No spam. One-click unsubscribe.</p>
    </section>
  );
}
