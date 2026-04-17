// src/app/api/preferences/route.ts
import { NextResponse } from 'next/server';
import { coercePrefs, encodeCookie } from '@/lib/prefs'; // <- matches the prefs file path

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const prefs = coercePrefs(payload);
  if (!prefs) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  // NOTE: If you switch this route to the Edge runtime, Buffer isn't available.
  // Keep default Node.js runtime (no `export const runtime = 'edge'`), or replace Buffer in encodeCookie.

  const cookie = [
    `v_prefs=${encodeCookie(prefs)}`,
    'Path=/',
    'Max-Age=31536000',
    'SameSite=Lax',
    // 'Secure', // enable this in production (HTTPS) to send only over TLS
  ].join('; ');

  return new NextResponse(JSON.stringify({ ok: true, prefs }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}
