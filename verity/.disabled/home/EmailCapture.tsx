'use client';
import { useState, useRef } from 'react';

export default function EmailCapture() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);

    // simple client validation
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) { setError('Enter a valid email.'); return; }

    // honeypot — bots often fill hidden fields
    if (honeypot.current?.value) { setOk(true); return; }

    try {
      setLoading(true);
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok && res.status !== 204) throw new Error('Failed');
      setOk(true);
      setEmail('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md items-center gap-2" aria-describedby="email-help">
      <label htmlFor="email" className="sr-only">Email address</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
        aria-invalid={!!error}
        aria-describedby="email-help"
      />
      {/* Honeypot (hidden from users) */}
      <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-neutral-900 hover:bg-white disabled:opacity-60"
      >
        {loading ? 'Starting…' : 'Start free'}
      </button>
      <div className="sr-only" aria-live="polite" id="email-help">
        {ok ? 'Check your inbox — magic link sent.' : error ? error : 'Enter your email to start free.'}
      </div>
      {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="mt-1 text-sm text-emerald-400">Check your inbox — magic link sent.</p> : null}
    </form>
  );
}
