import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface Payload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  target: string; // 'all' | 'electorate:Bennelong' | 'member:uuid' | 'token:xxx'
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { type, title, body, data, target } = payload;
  if (!type || !title || !body || !target) {
    return new Response(JSON.stringify({ error: 'Missing required fields: type, title, body, target' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Query push_tokens by target
  let query = supabase
    .from('push_tokens')
    .select('token, user_id')
    .eq('is_active', true);

  if (target.startsWith('electorate:')) {
    query = query.eq('electorate', target.slice(11));
  } else if (target.startsWith('member:')) {
    query = query.eq('member_id', target.slice(7));
  } else if (target.startsWith('token:')) {
    query = query.eq('token', target.slice(6));
  }
  // else 'all' → no extra filter

  const { data: tokens, error: tokensErr } = await query;
  if (tokensErr) {
    console.error('push_tokens query error:', tokensErr);
    return new Response(JSON.stringify({ error: tokensErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!tokens?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no matching tokens' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Filter by notification preferences for signed-in users
  const userIds = [...new Set(
    (tokens as Array<{ token: string; user_id: string | null }>)
      .map(t => t.user_id)
      .filter((id): id is string => Boolean(id))
  )];

  let prefsMap: Record<string, boolean> = {};
  if (userIds.length > 0) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(`user_id, ${type}`)
      .in('user_id', userIds);
    prefsMap = Object.fromEntries(
      (prefs ?? []).map((p: Record<string, unknown>) => [p.user_id as string, p[type] as boolean])
    );
  }

  const filteredTokens = (tokens as Array<{ token: string; user_id: string | null }>).filter(t => {
    if (!t.user_id) return true; // anonymous → always send
    const pref = prefsMap[t.user_id];
    return pref === undefined || pref === true; // default true if no preference row
  });

  if (!filteredTokens.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'all users opted out' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Batch send via Expo Push API (100 per request)
  const messages = filteredTokens.map(t => ({
    to: t.token,
    title,
    body,
    data: data ?? {},
    sound: 'default',
  }));

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      });
      const result = await res.json();
      const tickets: Array<{ status: string }> = result.data ?? [];
      sent += tickets.filter(t => t.status === 'ok').length;
      failed += tickets.filter(t => t.status !== 'ok').length;
    } catch (e) {
      console.error('Expo push batch error:', e);
      failed += batch.length;
    }
  }

  // 4. Log to notification_log
  await supabase.from('notification_log').insert({
    notification_type: type,
    title,
    body,
    recipients: sent,
  }).then(({ error }) => {
    if (error) console.error('notification_log insert error:', error);
  });

  return new Response(JSON.stringify({ ok: true, sent, failed, total: filteredTokens.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
