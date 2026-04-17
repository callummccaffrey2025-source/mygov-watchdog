import { NextResponse } from 'next/server';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const sent = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret');
  if (!secret || sent !== secret) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const fileUrl = pathToFileURL(path.join(process.cwd(), 'scripts/ingest-aph-divisions.mjs')).href;
    const mod: unknown = await import(fileUrl);
    const fn =
      (mod as any)?.default && typeof (mod as any).default === 'function'
        ? (mod as any).default
        : (mod as any)?.run && typeof (mod as any).run === 'function'
        ? (mod as any).run
        : null;
    if (fn) await fn();
    else console.warn('[cron] divisions module has no default/run');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cron] divisions error', err);
    return new NextResponse('Error', { status: 500 });
  }
}
