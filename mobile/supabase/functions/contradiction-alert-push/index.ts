// Supabase Edge Function — contradiction-alert-push
//
// Sends push notifications to users following an MP whose record contradicts
// their public statements. Triggered hourly or after contradiction confirmation.
//
// Deploy:
//   supabase functions deploy contradiction-alert-push --project-ref zmmglikiryuftqmoprqm
//
// Trigger via pg_cron (every hour):
//   SELECT cron.schedule('contradiction-alert-push', '15 * * * *',
//     $$SELECT net.http_post(
//       'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/contradiction-alert-push',
//       '{}', 'application/json',
//       ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))]
//     )$$
//   );

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, any>) {
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data,
  }));

  const results: any[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    results.push(await res.json().catch(() => ({})));
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ── 1. Find recently confirmed contradictions ────────────────────────
    const { data: contradictions } = await supabase
      .from('mp_contradictions')
      .select('id, member_id, claim_text, ai_explanation')
      .eq('status', 'confirmed')
      .gte('created_at', oneHourAgo);

    if (!contradictions?.length) {
      return new Response(
        JSON.stringify({ message: 'No recent confirmed contradictions', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let totalSent = 0;
    const logEntries: any[] = [];

    for (const contradiction of contradictions) {
      // ── 2. Find users following this MP ────────────────────────────────
      const { data: follows } = await supabase
        .from('user_follows')
        .select('user_id')
        .eq('followed_id', contradiction.member_id);

      if (!follows?.length) continue;

      const followerIds = follows.map((f: any) => f.user_id);

      // ── 3. Get push tokens for followers ───────────────────────────────
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, user_id')
        .in('user_id', followerIds)
        .not('token', 'is', null);

      if (!tokens?.length) continue;

      // ── 4. Filter by notification preferences ──────────────────────────
      // Use breaking_news as proxy until contradiction_alerts column exists
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('user_id, breaking_news, contradiction_alerts')
        .in('user_id', followerIds);

      const optedOut = new Set<string>();
      for (const np of (notifPrefs || [])) {
        const enabled = (np as any)?.contradiction_alerts ?? np.breaking_news;
        if (enabled === false) optedOut.add(np.user_id);
      }

      // ── 5. Rate limit: max 1 contradiction push per user per 24h ──────
      const { data: recentPushes } = await supabase
        .from('notification_log')
        .select('data')
        .eq('notification_type', 'contradiction_alert')
        .gte('sent_at', oneDayAgo);

      const recentlyNotified = new Set<string>();
      for (const entry of (recentPushes || [])) {
        const recipientIds = (entry.data as any)?.recipient_user_ids;
        if (Array.isArray(recipientIds)) {
          for (const uid of recipientIds) recentlyNotified.add(uid);
        }
      }

      // ── 6. Build eligible token list ───────────────────────────────────
      const eligibleTokens: string[] = [];
      const eligibleUserIds: string[] = [];
      for (const t of tokens) {
        if (!t.user_id || optedOut.has(t.user_id) || recentlyNotified.has(t.user_id)) continue;
        eligibleTokens.push(t.token);
        eligibleUserIds.push(t.user_id);
      }

      if (!eligibleTokens.length) continue;

      // ── 7. Get MP name ─────────────────────────────────────────────────
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name')
        .eq('id', contradiction.member_id)
        .single();

      if (!member) continue;

      const mpName = `${member.first_name} ${member.last_name}`;
      const title = `${mpName}: record contradicts statement`;
      const body = truncate(contradiction.ai_explanation || contradiction.claim_text || '', 80);
      const navData = {
        screen: 'ContradictionDetail',
        contradictionId: contradiction.id,
      };

      // ── 8. Send push notifications ─────────────────────────────────────
      await sendExpoPush(eligibleTokens, title, body, navData);
      totalSent += eligibleTokens.length;

      // ── 9. Write to user_notifications for in-app ActivityScreen ───────
      const notifRows = eligibleUserIds.map(uid => ({
        user_id: uid,
        notification_type: 'contradiction_alert',
        title,
        body,
        data: navData,
        is_read: false,
      }));
      await supabase.from('user_notifications').insert(notifRows).catch(() => {});

      // ── 10. Log ────────────────────────────────────────────────────────
      logEntries.push({
        notification_type: 'contradiction_alert',
        member_id: contradiction.member_id,
        title,
        body,
        data: { ...navData, recipient_user_ids: eligibleUserIds },
        recipients: eligibleTokens.length,
        sent_at: new Date().toISOString(),
      });
    }

    // ── Batch insert logs ────────────────────────────────────────────────
    if (logEntries.length > 0) {
      await supabase.from('notification_log').insert(logEntries);
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${totalSent} contradiction alerts for ${logEntries.length} contradictions`,
        sent: totalSent,
        contradictions: logEntries.length,
        log: logEntries,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
