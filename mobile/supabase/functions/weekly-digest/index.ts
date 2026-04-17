// Supabase Edge Function — weekly-digest
//
// Runs every Sunday at 6pm AEST (8am UTC Sunday) via pg_cron.
// Compiles a week's highlights and sends via Resend (or compatible SMTP).
//
// Required secrets:
//   RESEND_API_KEY — from resend.com (free tier: 3000/mo)
//   DIGEST_FROM_EMAIL — e.g. "Verity <brief@verity.run>"
//
// Deploy:
//   supabase functions deploy weekly-digest --project-ref zmmglikiryuftqmoprqm

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('DIGEST_FROM_EMAIL') ?? 'Verity <brief@verity.run>';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanDivisionName(raw: string): string {
  return raw
    .replace(/^Bills?\s*[—\-]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final).*$/i, '')
    .trim();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
}

// Build the email HTML — minimal, personal, not marketing
function buildHtml(params: {
  displayName: string;
  weekStart: string;
  weekEnd: string;
  briefItems: string[];
  mpName: string | null;
  mpVotes: number;
  mpSpeeches: number;
  mpLatestVote: { bill: string; vote: string } | null;
  pollsVoted: number;
  billsRead: number;
  streakDays: number;
  electorate: string | null;
}): string {
  const {
    displayName, weekStart, weekEnd, briefItems, mpName, mpVotes, mpSpeeches,
    mpLatestVote, pollsVoted, billsRead, streakDays, electorate,
  } = params;

  const range = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your week in Australian politics</title>
</head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A2E;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#FFFFFF;">

    <div style="border-bottom:2px solid #00843D;padding-bottom:16px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#00843D;letter-spacing:1.2px;margin-bottom:4px;">VERITY WEEKLY BRIEF</div>
      <div style="font-size:22px;font-weight:700;color:#1A1A2E;">Your week in Australian politics</div>
      <div style="font-size:13px;color:#6B7280;margin-top:4px;">${range}</div>
    </div>

    <p style="font-size:15px;line-height:22px;color:#1A1A2E;margin:0 0 20px;">
      Hi ${displayName},
    </p>

    <p style="font-size:15px;line-height:22px;color:#1A1A2E;margin:0 0 24px;">
      Here's what happened in parliament this week.
    </p>

    ${briefItems.length ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Top 3 this week</div>
      ${briefItems.map(item => `
        <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
          <span style="color:#00843D;font-size:16px;line-height:22px;margin-right:8px;">•</span>
          <span style="font-size:15px;line-height:22px;color:#1A1A2E;">${item}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${mpName ? `
    <div style="background:#F8F9FA;border-radius:12px;padding:16px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Your MP this week</div>
      <div style="font-size:16px;font-weight:700;color:#1A1A2E;margin-bottom:6px;">${mpName}${electorate ? ` · ${electorate}` : ''}</div>
      <div style="font-size:14px;line-height:20px;color:#374151;">
        ${mpVotes} vote${mpVotes !== 1 ? 's' : ''} cast · ${mpSpeeches} speech${mpSpeeches !== 1 ? 'es' : ''} given
      </div>
      ${mpLatestVote ? `
      <div style="font-size:14px;color:#374151;margin-top:6px;">
        Latest: voted <strong style="color:${mpLatestVote.vote === 'aye' ? '#059669' : '#DC2626'};">${mpLatestVote.vote === 'aye' ? 'YES' : 'NO'}</strong> on ${mpLatestVote.bill}
      </div>
      ` : ''}
    </div>
    ` : ''}

    <div style="display:flex;gap:10px;margin-bottom:28px;">
      <div style="flex:1;background:#F8F9FA;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#00843D;">${billsRead}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px;">Bills read</div>
      </div>
      <div style="flex:1;background:#F8F9FA;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#00843D;">${pollsVoted}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px;">Polls voted</div>
      </div>
      <div style="flex:1;background:#F8F9FA;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#00843D;">${streakDays}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px;">Day streak</div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:16px;">
      <a href="https://verity.run" style="display:inline-block;background:#00843D;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px;font-weight:600;">Open Verity</a>
    </div>

    <div style="border-top:1px solid #E5E7EB;padding-top:16px;margin-top:24px;font-size:12px;color:#9CA3AF;line-height:18px;">
      You're receiving this because you enabled weekly digests in Verity.
      <br>
      <a href="https://verity.run/unsubscribe" style="color:#6B7280;">Manage email preferences</a>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — would send to', to);
    return false;
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const now = new Date();
    const weekEnd = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    // 1. Top 3 brief items — pull from this week's national briefs
    const { data: briefs } = await supabase
      .from('daily_briefs')
      .select('ai_text, date')
      .eq('electorate', '__national__')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: false });

    const briefItems: string[] = [];
    for (const b of (briefs || [])) {
      const items = (b as any).ai_text?.what_happened as string[] | undefined;
      if (items?.length) briefItems.push(items[0]);
      if (briefItems.length >= 3) break;
    }

    // 2. Get eligible users
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('email_digest_enabled', true);

    if (!prefs?.length) {
      return new Response(
        JSON.stringify({ message: 'No users opted in', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let sent = 0;
    let skipped = 0;

    for (const pref of prefs) {
      try {
        // Check if we already sent this week
        const { data: alreadySent } = await supabase
          .from('email_digest_log')
          .select('id')
          .eq('user_id', pref.user_id)
          .eq('week_start', weekStart)
          .maybeSingle();

        if (alreadySent) { skipped++; continue; }

        // Get user email + auth details
        const { data: authUser } = await supabase.auth.admin.getUserById(pref.user_id);
        const email = authUser?.user?.email;
        if (!email) { skipped++; continue; }

        const displayName = (authUser.user.user_metadata?.full_name as string)
          || email.split('@')[0];

        // Get user prefs / MP
        const { data: userPref } = await supabase
          .from('user_preferences')
          .select('member_id, electorate')
          .eq('user_id', pref.user_id)
          .maybeSingle();

        let mpName: string | null = null;
        let mpVotes = 0;
        let mpSpeeches = 0;
        let mpLatestVote: { bill: string; vote: string } | null = null;

        if (userPref?.member_id) {
          const { data: member } = await supabase
            .from('members')
            .select('first_name, last_name')
            .eq('id', userPref.member_id)
            .single();
          if (member) mpName = `${member.first_name} ${member.last_name}`;

          const { data: votes } = await supabase
            .from('division_votes')
            .select('vote_cast, division:divisions(name, date)')
            .eq('member_id', userPref.member_id)
            .gte('created_at', weekStart + 'T00:00:00')
            .order('created_at', { ascending: false });

          mpVotes = votes?.length ?? 0;
          const latest = votes?.[0] as any;
          if (latest?.division?.name) {
            mpLatestVote = {
              bill: cleanDivisionName(latest.division.name),
              vote: latest.vote_cast,
            };
          }

          const { count: speechCount } = await supabase
            .from('hansard_speeches')
            .select('id', { count: 'exact', head: true })
            .eq('member_id', userPref.member_id)
            .gte('date', weekStart);
          mpSpeeches = speechCount ?? 0;
        }

        // User engagement stats for the week
        const { data: statsRows } = await supabase
          .from('user_engagement_stats')
          .select('bills_read, polls_voted, streak_days')
          .eq('user_id', pref.user_id)
          .gte('stat_date', weekStart)
          .order('stat_date', { ascending: false });

        let billsRead = 0, pollsVoted = 0, streakDays = 0;
        for (const r of (statsRows || [])) {
          billsRead += r.bills_read ?? 0;
          pollsVoted += r.polls_voted ?? 0;
          if (r.streak_days > streakDays) streakDays = r.streak_days;
        }

        const html = buildHtml({
          displayName, weekStart, weekEnd, briefItems,
          mpName, mpVotes, mpSpeeches, mpLatestVote,
          pollsVoted, billsRead, streakDays,
          electorate: userPref?.electorate ?? null,
        });

        const subject = `Your week in Australian politics — ${formatDate(weekStart)} to ${formatDate(weekEnd)}`;

        const ok = await sendEmail(email, subject, html);

        if (ok) {
          sent++;
          await supabase.from('email_digest_log').insert({
            user_id: pref.user_id,
            email,
            week_start: weekStart,
            week_end: weekEnd,
            status: 'sent',
          });

          await supabase
            .from('notification_preferences')
            .update({ email_digest_last_sent: new Date().toISOString() })
            .eq('user_id', pref.user_id);
        }
      } catch {
        // Skip this user and continue
      }
    }

    return new Response(
      JSON.stringify({ message: `Digest job complete`, sent, skipped, total_eligible: prefs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
