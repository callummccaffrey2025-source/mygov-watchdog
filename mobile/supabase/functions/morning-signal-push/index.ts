// Supabase Edge Function — morning-signal-push
//
// Sends the Morning Signal push notification to opted-in users at 7am AEST.
//
// Deploy:
//   supabase functions deploy morning-signal-push --project-ref zmmglikiryuftqmoprqm
//
// Trigger via pg_cron (21:00 UTC = 07:00 AEST):
//   SELECT cron.schedule('morning-signal-push', '0 21 * * *',
//     $$SELECT net.http_post(
//       'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/morning-signal-push',
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
    const today = new Date().toISOString().slice(0, 10);

    // ── 1. Get today's national Morning Signal ───────────────────────────
    const { data: signal } = await supabase
      .from('morning_signals')
      .select('*')
      .eq('electorate', '__national__')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!signal) {
      return new Response(
        JSON.stringify({ message: 'No Morning Signal found for today', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Extract first top_story headline for the push body
    let bodyText = 'Your daily civic intelligence briefing is ready';
    try {
      const topStories = typeof signal.top_stories === 'string'
        ? JSON.parse(signal.top_stories)
        : signal.top_stories;
      if (Array.isArray(topStories) && topStories.length > 0) {
        const firstHeadline = topStories[0]?.headline || topStories[0]?.title || '';
        if (firstHeadline) {
          bodyText = truncate(firstHeadline, 80);
        }
      }
    } catch {
      // Use default body text
    }

    // ── 2. Get active push tokens ────────────────────────────────────────
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .not('token', 'is', null);

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No active push tokens', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userIds = [...new Set(tokens.map((t: any) => t.user_id).filter(Boolean))];

    // ── 3. Filter by notification preferences ────────────────────────────
    // Use daily_brief as proxy until morning_signal column exists
    const { data: notifPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, daily_brief, morning_signal')
      .in('user_id', userIds);

    const optedOut = new Set<string>();
    for (const np of (notifPrefs || [])) {
      // Prefer morning_signal column if it exists, fall back to daily_brief
      const enabled = (np as any)?.morning_signal ?? np.daily_brief;
      if (enabled === false) optedOut.add(np.user_id);
    }

    // ── 4. Rate limit: one Morning Signal push per user per day ──────────
    const { data: sentToday } = await supabase
      .from('notification_log')
      .select('data')
      .eq('notification_type', 'morning_signal')
      .gte('sent_at', today + 'T00:00:00');

    const alreadySent = new Set<string>();
    for (const entry of (sentToday || [])) {
      const recipientIds = (entry.data as any)?.recipient_user_ids;
      if (Array.isArray(recipientIds)) {
        for (const uid of recipientIds) alreadySent.add(uid);
      }
    }

    // ── 5. Build eligible token list ─────────────────────────────────────
    const eligibleTokens: string[] = [];
    const eligibleUserIds: string[] = [];
    for (const t of tokens) {
      if (!t.user_id || optedOut.has(t.user_id) || alreadySent.has(t.user_id)) continue;
      eligibleTokens.push(t.token);
      eligibleUserIds.push(t.user_id);
    }

    if (!eligibleTokens.length) {
      return new Response(
        JSON.stringify({ message: 'All users opted out or already received today', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 6. Send push notifications ───────────────────────────────────────
    const title = 'Your Morning Signal';
    const navData = { screen: 'DailyBrief' };

    await sendExpoPush(eligibleTokens, title, bodyText, navData);

    // ── 7. Write to user_notifications for in-app ActivityScreen ─────────
    const notifRows = eligibleUserIds.map(uid => ({
      user_id: uid,
      notification_type: 'morning_signal',
      title,
      body: bodyText,
      data: navData,
      is_read: false,
    }));
    await supabase.from('user_notifications').insert(notifRows).catch(() => {});

    // ── 8. Log ───────────────────────────────────────────────────────────
    await supabase.from('notification_log').insert({
      notification_type: 'morning_signal',
      title,
      body: bodyText,
      data: { ...navData, recipient_user_ids: eligibleUserIds },
      recipients: eligibleTokens.length,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        message: `Morning Signal sent to ${eligibleTokens.length} users`,
        sent: eligibleTokens.length,
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
