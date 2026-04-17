import { NextResponse } from 'next/server';
export const revalidate = 0;

/** GET /api/unsubscribe?email=...&t=...  -> always 200 with simple message.
 *  TODO: connect to DB and mark unsubscribed by token or email.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email') ?? 'unknown';
  // TODO: look up token/email in your table and mark unsubscribed.
  console.log('[unsubscribe]', { email });
  return NextResponse.json({ ok: true, message: 'You have been unsubscribed.' });
}
