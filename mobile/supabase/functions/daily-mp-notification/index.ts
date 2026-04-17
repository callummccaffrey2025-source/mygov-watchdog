// Supabase Edge Function — daily-mp-notification
//
// Sends personalised push notifications about each user's MP.
// Triggered daily at 7am AEST via pg_cron.
//
// Deploy:
//   supabase functions deploy daily-mp-notification --project-ref zmmglikiryuftqmoprqm
//
// Trigger via pg_cron:
//   SELECT cron.schedule('daily-mp-notification', '0 21 * * *',
//     $$SELECT net.http_post(
//       'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/daily-mp-notification',
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanBillName(raw: string): string {
  return raw
    .replace(/^Bills?\s*[—\-]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final|bill as passed).*$/i, '')
    .trim();
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, any>) {
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  // Expo Push API accepts batches of up to 100
  const batches = [];
  for (let i = 0; i < messages.length; i += 100) {
    batches.push(messages.slice(i, i + 100));
  }

  for (const batch of batches) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // ── 1. Check if parliament sat yesterday ──────────────────────────────
    const { data: recentDivisions } = await supabase
      .from('divisions')
      .select('id')
      .gte('date', yesterday)
      .lte('date', today)
      .limit(1);

    const parliamentSat = (recentDivisions?.length ?? 0) > 0;

    if (!parliamentSat) {
      // Also check for speeches as a sitting indicator
      const { data: recentSpeeches } = await supabase
        .from('hansard_speeches')
        .select('id')
        .gte('date', yesterday)
        .lte('date', today)
        .limit(1);

      if ((recentSpeeches?.length ?? 0) === 0) {
        return new Response(
          JSON.stringify({ message: 'Parliament did not sit — no notifications sent', sent: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── 2. Get all users with push tokens and member_id ───────────────────
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id, member_id, electorate')
      .not('member_id', 'is', null)
      .not('token', 'is', null);

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens and MP', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Group users by MP ──────────────────────────────────────────────
    const mpGroups = new Map<string, { tokens: string[]; userIds: string[]; electorate: string }>();
    for (const t of tokens) {
      const mid = t.member_id;
      if (!mid) continue;
      const existing = mpGroups.get(mid);
      if (existing) {
        existing.tokens.push(t.token);
        if (t.user_id) existing.userIds.push(t.user_id);
      } else {
        mpGroups.set(mid, {
          tokens: [t.token],
          userIds: t.user_id ? [t.user_id] : [],
          electorate: t.electorate ?? '',
        });
      }
    }

    let totalSent = 0;
    const logEntries: any[] = [];

    // ── 4. For each MP, check activity and send notification ──────────────
    for (const [memberId, group] of mpGroups) {
      // Get MP name
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name')
        .eq('id', memberId)
        .single();

      if (!member) continue;
      const mpName = `${member.first_name} ${member.last_name}`;

      // Check votes (highest priority)
      const { data: votes } = await supabase
        .from('division_votes')
        .select('vote_cast, division:divisions(id, name, date)')
        .eq('member_id', memberId)
        .gte('created_at', yesterday + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(1);

      const latestVote = votes?.[0] as any;

      if (latestVote?.division?.name) {
        const billName = cleanBillName(latestVote.division.name);
        const voteCast = latestVote.vote_cast === 'aye' ? 'YES' : latestVote.vote_cast === 'no' ? 'NO' : latestVote.vote_cast?.toUpperCase();
        const title = `Your MP voted ${voteCast}`;
        const body = `${mpName} voted ${voteCast} on the ${billName}`;
        const data = {
          screen: 'bill',
          billId: latestVote.division.id,
          memberId,
        };

        await sendExpoPush(group.tokens, title, body, data);
        totalSent += group.tokens.length;

        logEntries.push({
          notification_type: 'mp_vote',
          member_id: memberId,
          title,
          body,
          recipients: group.tokens.length,
          sent_at: new Date().toISOString(),
        });
        continue;
      }

      // Check speeches (second priority)
      const { data: speeches } = await supabase
        .from('hansard_speeches')
        .select('debate_topic, date')
        .eq('member_id', memberId)
        .gte('date', yesterday)
        .order('date', { ascending: false })
        .limit(1);

      const latestSpeech = speeches?.[0] as any;

      if (latestSpeech?.debate_topic) {
        const topic = latestSpeech.debate_topic.length > 60
          ? latestSpeech.debate_topic.slice(0, 57) + '...'
          : latestSpeech.debate_topic;
        const title = `${mpName} spoke in parliament`;
        const body = `Your MP spoke about ${topic} yesterday`;
        const data = {
          screen: 'member',
          memberId,
        };

        await sendExpoPush(group.tokens, title, body, data);
        totalSent += group.tokens.length;

        logEntries.push({
          notification_type: 'mp_speech',
          member_id: memberId,
          title,
          body,
          recipients: group.tokens.length,
          sent_at: new Date().toISOString(),
        });
        continue;
      }

      // MP was absent on a sitting day
      if (parliamentSat) {
        // Count bills debated
        const { count } = await supabase
          .from('divisions')
          .select('id', { count: 'exact', head: true })
          .gte('date', yesterday)
          .lte('date', today);

        const billCount = count ?? 0;
        const title = `${mpName} was absent`;
        const body = `Your MP was absent from parliament yesterday — ${billCount} bill${billCount !== 1 ? 's were' : ' was'} debated without them`;
        const data = {
          screen: 'member',
          memberId,
        };

        await sendExpoPush(group.tokens, title, body, data);
        totalSent += group.tokens.length;

        logEntries.push({
          notification_type: 'mp_absent',
          member_id: memberId,
          title,
          body,
          recipients: group.tokens.length,
          sent_at: new Date().toISOString(),
        });
      }
    }

    // ── 5. Log all notifications ──────────────────────────────────────────
    if (logEntries.length > 0) {
      await supabase.from('notification_log').insert(logEntries);
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${totalSent} notifications for ${logEntries.length} MPs`,
        sent: totalSent,
        mps: logEntries.length,
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
