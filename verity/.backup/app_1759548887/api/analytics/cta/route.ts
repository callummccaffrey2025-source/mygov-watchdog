import { NextResponse } from 'next/server';

export const revalidate = 0;

/** GET: convenience so opening this route in a tab returns 200 instead of 405 */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

/** POST: quiet no-op sink; logs payload in dev */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (process.env.NODE_ENV !== 'production') {
      console.log('[analytics/cta]', body);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
