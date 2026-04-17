import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // Opaque in prod — just for uptime checks
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  // Dev: keep your helpful panel mirrored at /api/health
  const flags = {
    trending: !!process.env.NEXT_PUBLIC_SHOW_TRENDING,
    plausible: !!process.env.NEXT_PUBLIC_ENABLE_PLAUSIBLE,
  };
  const deps = {
    TRENDING_JSON_present: !!process.env.TRENDING_JSON,
    PLAUSIBLE_DOMAIN_present: !!process.env.PLAUSIBLE_DOMAIN,
    EMAIL_WEBHOOK_URL_present: !!process.env.EMAIL_WEBHOOK_URL,
  };
  return NextResponse.json({ env: process.env.NODE_ENV, flags, deps }, { status: 200 });
}
