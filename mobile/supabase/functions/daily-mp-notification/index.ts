// Supabase Edge Function — daily-mp-notification
//
// "What Did Your MP Do Today?" — the single most important engagement feature.
// Sends personalised push notifications about each user's MP every morning.
//
// Priority hierarchy:
//   1. Voted on a bill         → "Your MP voted YES on [Bill]"
//   2. Spoke in parliament     → "Your MP spoke about [topic]"
//   3. Mentioned in news       → "Your MP was mentioned in [X] news stories"
//   4. Posted an official post → "[Name] posted: [first 50 chars]"
//   5. Absent on a sitting day → "[Name] was absent — [X] bills debated without them"
//   6. Non-sitting day         → no notification sent (silent)
//
// Deploy:
//   supabase functions deploy daily-mp-notification --project-ref zmmglikiryuftqmoprqm
//
// Trigger via pg_cron (21:00 UTC = 07:00 AEST):
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, any>) {
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default' as const,
    title,
    body,
    data,
  }));

  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

/** Write a notification to user_notifications for the in-app ActivityScreen */
async function writeUserNotifications(
  userIds: string[],
  type: string,
  title: string,
  body: string,
  data: Record<string, any>,
) {
  if (!userIds.length) return;
  const rows = userIds.map(uid => ({
    user_id: uid,
    notification_type: type,
    title,
    body,
    data,
    is_read: false,
  }));
  // Batch insert — non-blocking, best-effort
  await supabase.from('user_notifications').insert(rows).catch(() => {});
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

    let parliamentSat = (recentDivisions?.length ?? 0) > 0;

    if (!parliamentSat) {
      const { data: recentSpeeches } = await supabase
        .from('hansard_speeches')
        .select('id')
        .gte('date', yesterday)
        .lte('date', today)
        .limit(1);

      if ((recentSpeeches?.length ?? 0) > 0) {
        parliamentSat = true;
      }
    }

    // Even on non-sitting days, MPs can be in the news or post — so don't bail early.
    // We only skip the "absence" notification on non-sitting days.

    // ── 2. Resolve users → their MP ──────────────────────────────────────
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .not('user_id', 'is', null)
      .not('token', 'is', null);

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userIds = [...new Set(tokens.map((t: any) => t.user_id).filter(Boolean))];

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, member_id, electorate, postcode')
      .in('user_id', userIds);

    // Notification preferences — only send to users who want MP notifications
    const { data: notifPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, mp_votes')
      .in('user_id', userIds);

    const notifOptOut = new Set<string>();
    for (const np of (notifPrefs || [])) {
      if (np.mp_votes === false) notifOptOut.add(np.user_id);
    }

    // Build prefs map and resolve postcodes → member_id where needed
    const prefsMap = new Map<string, { member_id: string | null; electorate: string | null }>();
    for (const p of (prefs || [])) {
      prefsMap.set(p.user_id, { member_id: p.member_id, electorate: p.electorate });
    }

    const unresolvedUsers = (prefs || []).filter(p => !p.member_id && p.postcode);
    if (unresolvedUsers.length > 0) {
      const postcodes = [...new Set(unresolvedUsers.map(u => u.postcode))];
      for (const postcode of postcodes) {
        const { data: electorates } = await supabase
          .from('electorates')
          .select('id')
          .contains('postcodes', [postcode])
          .eq('level', 'federal')
          .limit(1);
        const elecId = electorates?.[0]?.id;
        if (!elecId) continue;
        const { data: members } = await supabase
          .from('members')
          .select('id')
          .eq('electorate_id', elecId)
          .eq('chamber', 'house')
          .eq('is_active', true)
          .limit(1);
        const memberId = members?.[0]?.id;
        if (!memberId) continue;
        for (const u of unresolvedUsers.filter(u2 => u2.postcode === postcode)) {
          const existing = prefsMap.get(u.user_id);
          if (existing) existing.member_id = memberId;
        }
      }
    }

    // Build token-to-user map
    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      if (!t.user_id) continue;
      const arr = tokensByUser.get(t.user_id) ?? [];
      arr.push(t.token);
      tokensByUser.set(t.user_id, arr);
    }

    // ── 3. Group users by MP ──────────────────────────────────────────────
    const mpGroups = new Map<string, { tokens: string[]; userIds: string[]; electorate: string }>();
    for (const [userId, userTokens] of tokensByUser) {
      if (notifOptOut.has(userId)) continue;
      const pref = prefsMap.get(userId);
      const mid = pref?.member_id;
      if (!mid) continue;

      const existing = mpGroups.get(mid);
      if (existing) {
        existing.tokens.push(...userTokens);
        existing.userIds.push(userId);
      } else {
        mpGroups.set(mid, {
          tokens: [...userTokens],
          userIds: [userId],
          electorate: pref?.electorate ?? '',
        });
      }
    }

    let totalSent = 0;
    const logEntries: any[] = [];

    // ── 4. For each MP, check activity across 5 priority levels ──────────
    for (const [memberId, group] of mpGroups) {
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name')
        .eq('id', memberId)
        .single();

      if (!member) continue;
      const mpName = `${member.first_name} ${member.last_name}`;

      let title = '';
      let body = '';
      let navData: Record<string, any> = {};
      let notifType = '';

      // ── Priority 1: Voted on a bill ────────────────────────────────────
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
        const voteCast = latestVote.vote_cast === 'aye' ? 'YES'
          : latestVote.vote_cast === 'no' ? 'NO'
          : latestVote.vote_cast?.toUpperCase();
        title = `Your MP voted ${voteCast}`;
        body = `${mpName} voted ${voteCast} on the ${truncate(billName, 80)}`;
        navData = { screen: 'bill', billId: latestVote.division.id, memberId };
        notifType = 'mp_vote';
      }

      // ── Priority 2: Spoke in parliament ────────────────────────────────
      if (!notifType) {
        const { data: speeches } = await supabase
          .from('hansard_speeches')
          .select('debate_topic, date')
          .eq('member_id', memberId)
          .gte('date', yesterday)
          .order('date', { ascending: false })
          .limit(1);

        const latestSpeech = speeches?.[0] as any;
        if (latestSpeech?.debate_topic) {
          const topic = truncate(latestSpeech.debate_topic, 60);
          title = `${mpName} spoke in parliament`;
          body = `Your MP spoke about ${topic} yesterday`;
          navData = { screen: 'member', memberId };
          notifType = 'mp_speech';
        }
      }

      // ── Priority 3: Mentioned in news ──────────────────────────────────
      if (!notifType) {
        // Search news articles from the last 24h that mention this MP
        const nameVariants = [
          `${member.first_name} ${member.last_name}`,
          member.last_name,
        ];
        // Use ilike search on article titles/descriptions for the MP's full name
        const { data: newsArticles, count: newsCount } = await supabase
          .from('news_articles')
          .select('id, story_id', { count: 'exact', head: false })
          .gte('published_at', yesterday + 'T00:00:00')
          .or(`title.ilike.%${nameVariants[0]}%,description.ilike.%${nameVariants[0]}%`)
          .limit(5);

        const storyCount = newsCount ?? 0;
        if (storyCount > 0) {
          // Find a story_id to deep-link to
          const storyId = newsArticles?.[0]?.story_id;
          title = `${mpName} in the news`;
          body = storyCount === 1
            ? `Your MP was mentioned in a news story yesterday`
            : `Your MP was mentioned in ${storyCount} news stories yesterday`;
          navData = storyId
            ? { screen: 'news', storyId }
            : { screen: 'member', memberId };
          notifType = 'mp_news';
        }
      }

      // ── Priority 4: Posted an official post ────────────────────────────
      if (!notifType) {
        const { data: posts } = await supabase
          .from('official_posts')
          .select('id, title, body')
          .eq('member_id', memberId)
          .gte('published_at', yesterday + 'T00:00:00')
          .order('published_at', { ascending: false })
          .limit(1);

        const latestPost = posts?.[0] as any;
        if (latestPost) {
          const postTitle = latestPost.title || latestPost.body || '';
          title = `${mpName} posted`;
          body = truncate(postTitle, 80);
          navData = { screen: 'member', memberId };
          notifType = 'mp_post';
        }
      }

      // ── Priority 5: Absent on a sitting day ────────────────────────────
      if (!notifType && parliamentSat) {
        const { count } = await supabase
          .from('divisions')
          .select('id', { count: 'exact', head: true })
          .gte('date', yesterday)
          .lte('date', today);

        const billCount = count ?? 0;
        title = `${mpName} had no recorded activity`;
        body = billCount > 0
          ? `Your MP was absent from parliament yesterday — ${billCount} bill${billCount !== 1 ? 's were' : ' was'} debated without them`
          : `Your MP had no recorded activity in parliament yesterday`;
        navData = { screen: 'member', memberId };
        notifType = 'mp_absent';
      }

      // ── Send notification ──────────────────────────────────────────────
      if (!notifType) continue; // Non-sitting day, no news/posts — skip

      await sendExpoPush(group.tokens, title, body, navData);
      totalSent += group.tokens.length;

      // Write to user_notifications for in-app ActivityScreen
      await writeUserNotifications(group.userIds, notifType, title, body, navData);

      logEntries.push({
        notification_type: notifType,
        member_id: memberId,
        title,
        body,
        data: navData,
        recipients: group.tokens.length,
        sent_at: new Date().toISOString(),
      });
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
