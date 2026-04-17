// Supabase Edge Function — bill-change-notify
//
// Runs hourly. Finds bill changes in the last hour that haven't been notified,
// finds users who saved/followed each bill, and sends push notifications.
//
// Deploy:
//   supabase functions deploy bill-change-notify --project-ref zmmglikiryuftqmoprqm
//
// Schedule (hourly):
//   SELECT cron.schedule('bill-change-notify', '0 * * * *', $$...$$);

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

// Map parliamentary status text to plain English stage
function cleanStage(status: string | null): string {
  if (!status) return 'updated';
  const s = status.toLowerCase();
  if (s.includes('assent') || s.includes('act')) return 'passed into law';
  if (s.includes('passed')) return 'passed';
  if (s.includes('defeated') || s.includes('withdrawn') || s.includes('lapsed')) return 'failed';
  if (s.includes('third')) return 'third reading';
  if (s.includes('second')) return 'second reading';
  if (s.includes('first')) return 'first reading';
  if (s.includes('committee') || s.includes('referred')) return 'committee stage';
  if (s.includes('introduced')) return 'introduced';
  return status.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Look for changes in the last hour that we haven't notified on yet.
    // We track notified state via a separate column or the notification_log.
    const sinceTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: changes } = await supabase
      .from('bill_changes')
      .select('id, bill_id, previous_status, new_status, changed_at')
      .gte('changed_at', sinceTime)
      .order('changed_at', { ascending: false });

    if (!changes?.length) {
      return new Response(
        JSON.stringify({ message: 'No recent changes', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let totalSent = 0;
    const processedBills = new Set<string>();

    for (const change of changes) {
      if (processedBills.has(change.bill_id)) continue;
      processedBills.add(change.bill_id);

      // Check if we've already notified for this change
      const { data: existingLog } = await supabase
        .from('notification_log')
        .select('id')
        .eq('notification_type', 'bill_change')
        .gte('sent_at', sinceTime)
        .contains('title', change.bill_id.slice(0, 8))
        .limit(1);

      if (existingLog?.length) continue;

      // Get the bill
      const { data: bill } = await supabase
        .from('bills')
        .select('id, title, short_title')
        .eq('id', change.bill_id)
        .single();

      if (!bill) continue;

      const billTitle = bill.short_title || bill.title;
      const stage = cleanStage(change.new_status);

      // Find users who saved this bill
      const { data: savers } = await supabase
        .from('user_saves')
        .select('user_id')
        .eq('content_type', 'bill')
        .eq('content_id', change.bill_id)
        .not('user_id', 'is', null);

      // Find users who follow this bill
      const { data: followers } = await supabase
        .from('user_follows')
        .select('user_id')
        .eq('entity_type', 'bill')
        .eq('entity_id', change.bill_id)
        .not('user_id', 'is', null);

      // Combine user IDs
      const userIds = new Set<string>();
      for (const s of savers || []) if (s.user_id) userIds.add(s.user_id);
      for (const f of followers || []) if (f.user_id) userIds.add(f.user_id);

      if (userIds.size === 0) continue;

      // Get push tokens for those users
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', Array.from(userIds))
        .not('token', 'is', null);

      if (!tokens?.length) continue;

      const title = `${billTitle.slice(0, 50)}${billTitle.length > 50 ? '...' : ''}`;
      const body = `Just moved to ${stage}.`;

      // Send via Expo
      const messages = tokens.map((t: any) => ({
        to: t.token,
        sound: 'default',
        title,
        body,
        data: { screen: 'bill', billId: change.bill_id },
      }));

      for (let i = 0; i < messages.length; i += 100) {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
      }

      totalSent += tokens.length;

      // Log
      await supabase.from('notification_log').insert({
        notification_type: 'bill_change',
        title: `${billTitle} (${change.bill_id.slice(0, 8)})`,
        body,
        recipients: tokens.length,
      });
    }

    return new Response(
      JSON.stringify({ message: `Processed ${processedBills.size} bills, sent ${totalSent} notifications`, sent: totalSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
