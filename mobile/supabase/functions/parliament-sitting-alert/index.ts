// Supabase Edge Function — parliament-sitting-alert
//
// Sends a push notification on the first sitting day after a recess.
// Triggered daily at 8:30am AEST (10:30pm UTC) via pg_cron.
//
// Deploy:
//   supabase functions deploy parliament-sitting-alert --project-ref zmmglikiryuftqmoprqm
//
// Schedule:
//   SELECT cron.schedule('parliament-sitting-alert', '30 22 * * *', $$...$$);

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Check if today is a sitting day
    const { data: todaySitting } = await supabase
      .from('sitting_calendar')
      .select('date, description')
      .eq('date', today)
      .eq('is_sitting', true)
      .limit(1);

    if (!todaySitting?.length) {
      return new Response(
        JSON.stringify({ message: 'Not a sitting day', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if yesterday was a sitting day — if yes, this isn't a "return from recess"
    const { data: yesterdaySitting } = await supabase
      .from('sitting_calendar')
      .select('date')
      .eq('date', yesterday)
      .eq('is_sitting', true)
      .limit(1);

    if (yesterdaySitting?.length) {
      return new Response(
        JSON.stringify({ message: 'Consecutive sitting day — no alert needed', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // This is the first sitting day after a recess — send notification
    const description = todaySitting[0].description || '';
    const title = 'Parliament is back';
    const body = description
      ? `Parliament resumes today. ${description}`
      : "Parliament resumes today. Here's what's coming up this week.";

    // Get all push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .not('token', 'is', null);

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ message: 'No push tokens', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Send via Expo Push API in batches
    const messages = tokens.map((t: any) => ({
      to: t.token,
      sound: 'default',
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

    // Log
    await supabase.from('notification_log').insert({
      notification_type: 'parliament_sitting',
      title,
      body,
      recipients: tokens.length,
    });

    return new Response(
      JSON.stringify({ message: `Parliament back — sent ${tokens.length} notifications`, sent: tokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
