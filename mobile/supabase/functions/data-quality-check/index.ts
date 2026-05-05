// Supabase Edge Function — data-quality-check
//
// Runs data freshness + integrity checks and logs results to pipeline_runs.
// Designed for daily pg_cron trigger.
//
// Deploy:
//   supabase functions deploy data-quality-check --project-ref zmmglikiryuftqmoprqm
//
// pg_cron (run daily at 8am AEST / 22:00 UTC):
//   SELECT cron.schedule('data-quality-daily', '0 22 * * *',
//     $$SELECT net.http_post(
//       url := 'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/data-quality-check',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
//       body := '{}'::jsonb
//     )$$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Check {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

Deno.serve(async (_req: Request) => {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const checks: Check[] = [];

  // 1. News freshness — should have articles from last 12 hours
  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from('news_articles')
      .select('id', { count: 'exact', head: true })
      .gte('published_at', cutoff);
    checks.push({
      name: 'news_freshness',
      status: (count ?? 0) > 0 ? 'pass' : 'fail',
      message: `${count ?? 0} articles in last 12h`,
    });
  } catch (e: any) {
    checks.push({ name: 'news_freshness', status: 'fail', message: e.message });
  }

  // 2. Daily brief — should exist for today
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await db
      .from('daily_briefs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today);
    checks.push({
      name: 'daily_brief',
      status: (count ?? 0) > 0 ? 'pass' : 'warn',
      message: `${count ?? 0} briefs today`,
    });
  } catch (e: any) {
    checks.push({ name: 'daily_brief', status: 'fail', message: e.message });
  }

  // 3. Active members — should be 225
  try {
    const { count } = await db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    const expected = 225;
    checks.push({
      name: 'active_members',
      status: count === expected ? 'pass' : 'warn',
      message: `${count}/${expected} active`,
    });
  } catch (e: any) {
    checks.push({ name: 'active_members', status: 'fail', message: e.message });
  }

  // 4. Members without photos
  try {
    const { count } = await db
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('photo_url', null);
    checks.push({
      name: 'member_photos',
      status: (count ?? 0) === 0 ? 'pass' : 'fail',
      message: `${count ?? 0} missing photos`,
    });
  } catch (e: any) {
    checks.push({ name: 'member_photos', status: 'fail', message: e.message });
  }

  // 5. News story bias coverage
  try {
    const { count: total } = await db
      .from('news_stories')
      .select('id', { count: 'exact', head: true });
    const { count: withBias } = await db
      .from('news_stories')
      .select('id', { count: 'exact', head: true })
      .not('bias_score', 'is', null);
    const pct = total ? Math.round(((withBias ?? 0) / total) * 100) : 0;
    checks.push({
      name: 'bias_coverage',
      status: pct > 50 ? 'pass' : 'warn',
      message: `${pct}% of stories have bias data`,
    });
  } catch (e: any) {
    checks.push({ name: 'bias_coverage', status: 'fail', message: e.message });
  }

  // Summary
  const status = checks.some(c => c.status === 'fail') ? 'error'
    : checks.some(c => c.status === 'warn') ? 'warning' : 'success';

  // Log to pipeline_runs
  try {
    await db.from('pipeline_runs').insert({
      pipeline_name: 'data_quality_check',
      status,
      details: JSON.stringify({ checks }),
    });
  } catch {
    // pipeline_runs table may not exist
  }

  return new Response(JSON.stringify({ status, checks }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
