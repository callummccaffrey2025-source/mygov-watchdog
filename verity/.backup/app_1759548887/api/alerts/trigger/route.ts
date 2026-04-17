import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/mailer';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

  // 1) Find queued alerts
  const { data: queued } = await supa.from('alerts').select('*').eq('status','queued').limit(200);
  if (!queued?.length) return NextResponse.json({ ok:true, sent:0 });

  // 2) Send
  let sent = 0;
  for (const a of queued) {
    try {
      const to = a.email ?? a.user_email; // denormalize email onto alerts row in your trigger
      const subj = a.subject ?? 'Verity alert';
      const html = a.html ?? `<p>${a.summary ?? 'Update'}</p>`;
      await sendMail({ to: to, subject: subj, html: html });
      await supa.from('alerts').update({ status:'sent', sent_at: new Date().toISOString() }).eq('id', a.id);
      sent++;
    } catch (e) {
      await supa.from('alerts').update({ status:'failed' }).eq('id', a.id);
    }
  }
  return NextResponse.json({ ok:true, sent });
}
