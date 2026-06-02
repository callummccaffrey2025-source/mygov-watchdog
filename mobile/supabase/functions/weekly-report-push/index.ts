// Supabase Edge Function — weekly-report-push
//
// Sunday evening push notification: "This week in your electorate"
// Personalised per user: MP votes, bills affecting them, contracts.
//
// Deploy:
//   supabase functions deploy weekly-report-push --project-ref zmmglikiryuftqmoprqm
//
// Schedule (pg_cron, Sunday 5pm AEST = 7am UTC Sunday):
//   SELECT cron.schedule('weekly-report-push', '0 7 * * 0', $$...$$);

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

function cleanBillName(raw: string): string {
  return raw
    .replace(/^Bills?\s*[—\-]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final).*$/i, '')
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Get users with push tokens and postcode preferences
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .not('user_id', 'is', null)
      .not('token', 'is', null);

    if (!tokens?.length) {
      return new Response(JSON.stringify({ message: 'No tokens', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check notification preferences — only send to users who want weekly_summary
    const userIds = [...new Set(tokens.map((t: any) => t.user_id).filter(Boolean))];
    const { data: notifPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, weekly_summary')
      .in('user_id', userIds);

    const optedOut = new Set((notifPrefs || []).filter((n: any) => n.weekly_summary === false).map((n: any) => n.user_id));

    // Get user preferences for member_id
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, member_id, electorate, postcode')
      .in('user_id', userIds);

    const prefsMap = new Map<string, any>();
    for (const p of (prefs || [])) {
      prefsMap.set(p.user_id, p);
    }

    // Build token → user map
    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      if (!t.user_id || optedOut.has(t.user_id)) continue;
      const arr = tokensByUser.get(t.user_id) ?? [];
      arr.push(t.token);
      tokensByUser.set(t.user_id, arr);
    }

    // Get this week's stats
    const { count: totalDivisions } = await supabase
      .from('divisions')
      .select('id', { count: 'exact', head: true })
      .gte('date', weekAgo);

    const { count: totalBills } = await supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .gte('date_introduced', weekAgo)
      .not('aph_id', 'is', null);

    // Group users by MP for efficiency
    const mpGroups = new Map<string, { tokens: string[]; userIds: string[]; electorate: string }>();
    for (const [userId, userTokens] of tokensByUser) {
      const pref = prefsMap.get(userId);
      const mid = pref?.member_id;
      if (!mid) continue;
      const existing = mpGroups.get(mid);
      if (existing) {
        existing.tokens.push(...userTokens);
        existing.userIds.push(userId);
      } else {
        mpGroups.set(mid, { tokens: [...userTokens], userIds: [userId], electorate: pref?.electorate ?? '' });
      }
    }

    let totalSent = 0;

    for (const [memberId, group] of mpGroups) {
      // Get MP name
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name')
        .eq('id', memberId)
        .single();

      if (!member) continue;
      const mpName = `${member.first_name} ${member.last_name}`;

      // Count this MP's votes this week
      const { count: mpVoteCount } = await supabase
        .from('division_votes')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .gte('created_at', weekAgo + 'T00:00:00');

      // Get a notable vote (most recent non-procedural)
      const { data: notableVotes } = await supabase
        .from('division_votes')
        .select('vote_cast, division:divisions(name, date)')
        .eq('member_id', memberId)
        .gte('created_at', weekAgo + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(3);

      let notableVote = '';
      for (const v of (notableVotes || []) as any[]) {
        const name = v.division?.name || '';
        if (!name.startsWith('Business') && !name.startsWith('Motions') && !name.startsWith('Procedure')) {
          notableVote = cleanBillName(name);
          break;
        }
      }

      // Build the notification
      const parts: string[] = [];
      if (mpVoteCount && mpVoteCount > 0) {
        parts.push(`${mpName} voted ${mpVoteCount} time${mpVoteCount !== 1 ? 's' : ''}`);
      }
      if (notableVote) {
        parts.push(`including on ${notableVote.slice(0, 60)}`);
      }
      if (totalBills && totalBills > 0) {
        parts.push(`${totalBills} new bill${totalBills !== 1 ? 's' : ''} introduced`);
      }

      if (parts.length === 0) {
        parts.push('Parliament was quiet this week');
      }

      const title = `Your week in ${group.electorate || 'Parliament'}`;
      const body = parts.join('. ') + '.';

      // Send push
      const messages = group.tokens.map(token => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data: { screen: 'DailyBrief' },
      }));

      for (let i = 0; i < messages.length; i += 100) {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
      }

      totalSent += group.tokens.length;
    }

    // Log
    await supabase.from('notification_log').insert({
      notification_type: 'weekly_report',
      title: 'Weekly Report Push',
      body: `Sent to ${totalSent} users across ${mpGroups.size} electorates`,
      recipients: totalSent,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ message: `Weekly report sent to ${totalSent} users`, sent: totalSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
