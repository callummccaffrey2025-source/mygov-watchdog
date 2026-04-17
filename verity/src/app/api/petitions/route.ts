import { NextResponse } from 'next/server';
type Body = { title?: string; body?: string };
export async function POST(req: Request) {
  let data: Body | null = null;
  try { data = await req.json(); } catch {}
  const title = (data?.title ?? '').trim();
  const body = (data?.body ?? '').trim();
  if (title.length < 3 || title.length > 160 || body.length < 20 || body.length > 5000) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, echo: { title, body } });
}
