import { NextResponse } from 'next/server';

// Cache API response for 60s (SSR-friendly)
export const revalidate = 60;

export async function GET() {
  try {
    const src = process.env.TRENDING_JSON || '';
    let raw;
    if (!src) return NextResponse.json([], { status: 200 });

    if (src.trim().startsWith('[')) {
      raw = src;
    } else {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) return NextResponse.json([], { status: 200 });
      raw = await res.text();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NextResponse.json([], { status: 200 });

    const ALLOWED = ['House','Senate','Assembly','Legislative Council','Legislative Assembly'];

    const normalized = parsed.reduce((acc, x) => {
      if (!x || typeof x !== 'object') return acc;
      const ch = String(x.chamber ?? '');
      if (!ALLOWED.includes(ch)) return acc;

      const item = {
        id: String(x.id ?? ''),
        title: String(x.title ?? ''),
        chamber: ch,
        lastMovementAt: String(x.lastMovementAt ?? ''),
        status: String(x.status ?? ''),
        url: x.url ? String(x.url) : undefined,
      };

      if (
        item.id &&
        item.title &&
        item.status &&
        !Number.isNaN(Date.parse(item.lastMovementAt))
      ) acc.push(item);

      return acc;
    }, []);

    return NextResponse.json(normalized, { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
