import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const TERM_START = '2022-07-01';

    // ── Step 1: Get total representatives divisions this term ────────
    const { data: divData } = await supabase
      .from('divisions')
      .select('id', { count: 'exact', head: true })
      .eq('chamber', 'representatives')
      .gte('date', TERM_START);
    const totalRepsDivisions = divData?.length ?? 0;

    // Use a raw count query instead
    const { count: totalDivisions } = await supabase
      .from('divisions')
      .select('*', { count: 'exact', head: true })
      .eq('chamber', 'representatives')
      .gte('date', TERM_START);

    const totalRepDiv = totalDivisions ?? 640;

    // ── Step 2: Compute per-MP attendance + rebellions ───────────────
    // Fetch all active House members
    const { data: members } = await supabase
      .from('members')
      .select('id, party_id')
      .eq('is_active', true)
      .eq('chamber', 'house');

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ error: 'No members found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const metrics: any[] = [];

    // Process in batches of 20 to avoid timeouts
    for (let i = 0; i < members.length; i += 20) {
      const batch = members.slice(i, i + 20);

      const batchResults = await Promise.all(
        batch.map(async (member) => {
          // Get vote counts
          const { count: voteCount } = await supabase
            .from('division_votes')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', member.id)
            .in('vote_cast', ['aye', 'no']);

          const { count: rebellionCount } = await supabase
            .from('division_votes')
            .select('*', { count: 'exact', head: true })
            .eq('member_id', member.id)
            .eq('rebelled', true);

          const votes = voteCount ?? 0;
          const rebellions = rebellionCount ?? 0;

          if (votes === 0) return [];

          const attendanceRate = Math.round((votes / totalRepDiv) * 1000) / 10;

          const memberMetrics = [
            {
              metric_key: 'attendance_rate',
              scope: 'mp',
              scope_id: member.id,
              value: attendanceRate,
              display_value: `${attendanceRate}%`,
              unit: 'percent',
              source: 'verity',
              as_of: today,
              period: '47th Parliament',
              computed_at: now,
            },
            {
              metric_key: 'floor_crossings',
              scope: 'mp',
              scope_id: member.id,
              value: rebellions,
              display_value: `${rebellions}`,
              unit: 'count',
              source: 'verity',
              as_of: today,
              period: '47th Parliament',
              computed_at: now,
            },
            {
              metric_key: 'votes_cast',
              scope: 'mp',
              scope_id: member.id,
              value: votes,
              display_value: `${votes}`,
              unit: 'count',
              source: 'verity',
              as_of: today,
              period: '47th Parliament',
              computed_at: now,
            },
          ];

          return memberMetrics;
        }),
      );

      metrics.push(...batchResults.flat());
    }

    // ── Step 3: Compute party loyalty per MP ────────────────────────
    // Get all division votes with party context for this term
    // This is done per-party to get the majority direction
    const parties = [...new Set(members.map(m => m.party_id).filter(Boolean))];

    for (const partyId of parties) {
      const partyMembers = members.filter(m => m.party_id === partyId);

      // For each party member, we need to check if they voted with party majority
      // This is expensive per-member — simplified: count rebellions vs total
      for (const member of partyMembers) {
        const voteMetric = metrics.find(
          m => m.metric_key === 'votes_cast' && m.scope_id === member.id,
        );
        const crossingMetric = metrics.find(
          m => m.metric_key === 'floor_crossings' && m.scope_id === member.id,
        );

        if (voteMetric && crossingMetric) {
          const votes = Number(voteMetric.value);
          const crossings = Number(crossingMetric.value);
          if (votes > 0) {
            const loyaltyRate = Math.round(((votes - crossings) / votes) * 1000) / 10;
            metrics.push({
              metric_key: 'party_loyalty_rate',
              scope: 'mp',
              scope_id: member.id,
              value: loyaltyRate,
              display_value: `${loyaltyRate}%`,
              unit: 'percent',
              source: 'verity',
              as_of: today,
              period: '47th Parliament',
              computed_at: now,
            });
          }
        }
      }
    }

    // ── Step 4: Upsert — delete old MP metrics, insert fresh ────────
    await supabase
      .from('stats_metrics')
      .delete()
      .eq('scope', 'mp')
      .eq('source', 'verity');

    // Insert in batches of 100
    for (let i = 0; i < metrics.length; i += 100) {
      const batch = metrics.slice(i, i + 100);
      await supabase.from('stats_metrics').insert(batch);
    }

    // ── Step 5: Log heartbeat ───────────────────────────────────────
    await supabase.from('pipeline_heartbeats').upsert({
      pipeline_name: 'compute-stats',
      last_run_at: now,
      status: 'success',
      metadata: { mp_count: members.length, metrics_count: metrics.length },
    }, { onConflict: 'pipeline_name' });

    return new Response(
      JSON.stringify({
        success: true,
        members_processed: members.length,
        metrics_inserted: metrics.length,
        total_divisions: totalRepDiv,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
