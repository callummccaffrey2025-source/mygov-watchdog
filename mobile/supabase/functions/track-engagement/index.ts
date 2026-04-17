// Supabase Edge Function — track-engagement
//
// Upserts the current day's engagement row for the authenticated user.
// Computes streak_days by checking yesterday's row.
//
// Request body:
//   { event_type: string, event_data?: object, seconds?: number }
//
// event_type values:
//   'bill_read', 'mp_view', 'news_read', 'discussion_posted',
//   'poll_voted', 'share_created', 'session_time'
//
// Deploy:
//   supabase functions deploy track-engagement --project-ref zmmglikiryuftqmoprqm

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EVENT_COLUMN_MAP: Record<string, string> = {
  bill_read:          'bills_read',
  mp_view:            'mp_profiles_viewed',
  news_read:          'news_stories_read',
  discussion_posted:  'discussions_posted',
  poll_voted:         'polls_voted',
  share_created:      'share_cards_created',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    // Verify authenticated user via JWT in Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing auth' }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthenticated' }, 401);

    const body = await req.json() as { event_type: string; event_data?: any; seconds?: number };
    const { event_type, seconds } = body;

    if (!event_type) return jsonResponse({ error: 'Missing event_type' }, 400);

    // Use service-role client for DB writes (bypasses RLS)
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Compute streak: check yesterday's row
    let streakDays = 1;
    const { data: yesterdayRow } = await db
      .from('user_engagement_stats')
      .select('streak_days')
      .eq('user_id', user.id)
      .eq('stat_date', yesterday)
      .maybeSingle();

    if (yesterdayRow) {
      streakDays = (yesterdayRow.streak_days ?? 0) + 1;
    }

    // Check if today's row already exists — preserve its streak
    const { data: todayRow } = await db
      .from('user_engagement_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('stat_date', today)
      .maybeSingle();

    if (todayRow) {
      // Increment existing row
      const column = EVENT_COLUMN_MAP[event_type];
      const update: Record<string, any> = { updated_at: new Date().toISOString() };

      if (column) {
        update[column] = (todayRow[column] ?? 0) + 1;
      }
      if (event_type === 'session_time' && typeof seconds === 'number') {
        update.time_spent_seconds = (todayRow.time_spent_seconds ?? 0) + seconds;
      }

      await db
        .from('user_engagement_stats')
        .update(update)
        .eq('id', todayRow.id);

      return jsonResponse({
        ok: true,
        streak: todayRow.streak_days,
        updated: Object.keys(update).filter(k => k !== 'updated_at'),
      });
    }

    // Create new row for today
    const column = EVENT_COLUMN_MAP[event_type];
    const newRow: Record<string, any> = {
      user_id: user.id,
      stat_date: today,
      streak_days: streakDays,
    };
    if (column) newRow[column] = 1;
    if (event_type === 'session_time' && typeof seconds === 'number') {
      newRow.time_spent_seconds = seconds;
    }

    await db.from('user_engagement_stats').insert(newRow);

    return jsonResponse({ ok: true, streak: streakDays, created: true });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});
