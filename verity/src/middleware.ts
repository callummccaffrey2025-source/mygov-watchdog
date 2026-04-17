import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Bucket = { tokens: number; updatedAt: number };
type Store = Map<string, Bucket>;

// Typed global bag (avoids `any`)
const g = globalThis as typeof globalThis & { __rl_store?: Store };
const store: Store = g.__rl_store ?? new Map();
g.__rl_store = store;

/** Config */
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const CAPACITY = 100;             // 100 req / window
const REFILL_PER_MS = CAPACITY / WINDOW_MS;

function take(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const b = store.get(ip) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = Math.max(0, now - b.updatedAt);
  const refill = elapsed * REFILL_PER_MS;
  b.tokens = Math.min(CAPACITY, b.tokens + refill);
  b.updatedAt = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    store.set(ip, b);
    return { ok: true, remaining: Math.floor(b.tokens) };
  }
  store.set(ip, b);
  return { ok: false, remaining: 0 };
}

function ipFrom(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const first = xf.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();

  // Last resort: host or unknown (not a true client IP)
  return req.headers.get('host') ?? 'unknown';
}

function logEvent(req: NextRequest, extra: Record<string, unknown> = {}) {
  try {
    const data = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.nextUrl.pathname,
      q: Object.fromEntries(req.nextUrl.searchParams.entries()),
      ua: req.headers.get('user-agent') || '',
      ip: ipFrom(req),
      ...extra,
    };
    console.log(JSON.stringify({ type: 'req', ...data }));
  } catch {
    /* noop */
  }
}

export async function middleware(req: NextRequest) {
  // Gate /api/*
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = ipFrom(req);
  const { ok, remaining } = take(ip);

  logEvent(req, { remaining, rl: ok ? 'ok' : 'blocked' });

  if (!ok) {
    return new NextResponse(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'x-rate-remaining': String(remaining),
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set('x-rate-remaining', String(remaining));
  return res;
}

export const config = { matcher: ['/api/:path*'] };
