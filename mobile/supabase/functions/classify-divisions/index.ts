// Supabase Edge Function — classify-divisions
//
// Classifies untagged parliamentary divisions into policy issues using Claude Sonnet.
// Writes results to division_issue_tags. Idempotent — skips already-tagged divisions.
//
// Deploy:
//   supabase functions deploy classify-divisions --project-ref zmmglikiryuftqmoprqm
//
// Invoke (service role — not user-facing):
//   curl -X POST https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/classify-divisions \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"batch_size": 50}'
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // ── Auth: internal/cron only — caller must present the service role key ──
  {
    const __token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!__token || __token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parse batch_size from body
  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = await req.json();
    if (body?.batch_size && typeof body.batch_size === 'number') {
      batchSize = Math.min(body.batch_size, MAX_BATCH_SIZE);
    }
  } catch {
    // Use default
  }

  // ── Load policy issues ──────────────────────────────────────────────
  const { data: issues, error: issuesErr } = await db
    .from('policy_issues')
    .select('id, slug, name, stance_question')
    .eq('active', true)
    .order('sort_order');

  if (issuesErr || !issues?.length) {
    return jsonResponse({ error: 'Failed to load policy issues', detail: issuesErr?.message }, 500);
  }

  const issueList = issues.map((i: any) => `- ${i.slug}: "${i.name}" — ${i.stance_question}`).join('\n');
  const issueMap = new Map(issues.map((i: any) => [i.slug, i.id]));

  // ── Find untagged divisions ─────────────────────────────────────────
  // A division is "untagged" if it has no rows in division_issue_tags
  // Paginate to get all rows (Supabase default limit is 1000)
  const taggedSet = new Set<string>();
  let tagOffset = 0;
  while (true) {
    const { data: tagPage } = await db
      .from('division_issue_tags')
      .select('division_id')
      .range(tagOffset, tagOffset + 999);
    if (!tagPage?.length) break;
    for (const r of tagPage) taggedSet.add((r as any).division_id);
    tagOffset += tagPage.length;
    if (tagPage.length < 1000) break;
  }

  const allDivisions: any[] = [];
  let divOffset = 0;
  while (true) {
    const { data: divPage, error: divErr } = await db
      .from('divisions')
      .select('id, name, date, chamber, bill_title')
      .order('date', { ascending: false })
      .range(divOffset, divOffset + 999);
    if (divErr) {
      return jsonResponse({ error: 'Failed to load divisions', detail: divErr.message }, 500);
    }
    if (!divPage?.length) break;
    allDivisions.push(...divPage);
    divOffset += divPage.length;
    if (divPage.length < 1000) break;
  }

  const untagged = allDivisions.filter((d: any) => !taggedSet.has(d.id));
  const batch = untagged.slice(0, batchSize);

  if (batch.length === 0) {
    return jsonResponse({
      message: 'All divisions already tagged',
      total_divisions: allDivisions?.length ?? 0,
      tagged: taggedSet.size,
    });
  }

  // ── Classify in sub-batches of 10 (to fit context, manage cost) ─────
  const SUB_BATCH = 10;
  let totalTagged = 0;
  let totalSkipped = 0;
  const sampleTags: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < batch.length; i += SUB_BATCH) {
    const subBatch = batch.slice(i, i + SUB_BATCH);

    const divisionLines = subBatch.map((d: any, idx: number) =>
      `${idx + 1}. [${d.id}] "${d.name}" (${d.date}, ${d.chamber}${d.bill_title ? `, bill: "${d.bill_title}"` : ''})`
    ).join('\n');

    const prompt = `You are classifying Australian parliamentary divisions (votes) into policy issues for a civic intelligence app.

POLICY ISSUES:
${issueList}

DIVISIONS TO CLASSIFY:
${divisionLines}

For each division, determine:
1. Which 0-2 policy issues it relates to (use the slug). Many divisions relate to 0 issues (procedural motions, adjournments, etc.) — return an empty array for those.
2. Whether voting "Aye" supports the "support" side of the stance question (aye_supports: true/false).
3. Your confidence (0.0-1.0) that this classification is correct.
4. A one-line rationale.

Respond with a JSON array. Each element:
{
  "division_id": "<the id in brackets>",
  "tags": [
    { "issue_slug": "<slug>", "aye_supports": true|false, "confidence": 0.0-1.0, "rationale": "<one line>" }
  ]
}

If a division is procedural or doesn't clearly map to any issue, return "tags": [].
Be conservative — only tag when you're reasonably confident. Many parliamentary divisions are procedural.`;

    try {
      const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4000,
          system: 'You are a factual Australian parliamentary analyst. Respond only with valid JSON, no markdown fences.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text();
        const errMsg = `Anthropic API error for sub-batch ${i}: ${apiResp.status} ${errText.slice(0, 300)}`;
        console.error(errMsg);
        errors.push(errMsg);
        continue;
      }

      const data = await apiResp.json();
      const text = data?.content?.[0]?.text?.trim() ?? '';

      // Parse JSON — handle potential markdown fences
      const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      let results: any[];
      try {
        results = JSON.parse(jsonStr);
      } catch {
        const parseErr = `JSON parse error for sub-batch ${i}: ${text.slice(0, 200)}`;
        console.error(parseErr);
        errors.push(parseErr);
        continue;
      }

      // Write tags to database
      for (const result of results) {
        if (!result.division_id || !Array.isArray(result.tags)) continue;

        if (result.tags.length === 0) {
          totalSkipped++;
          continue;
        }

        for (const tag of result.tags) {
          const issueId = issueMap.get(tag.issue_slug);
          if (!issueId) {
            console.warn(`Unknown issue slug: ${tag.issue_slug}`);
            continue;
          }

          const row = {
            division_id: result.division_id,
            issue_id: issueId,
            aye_supports: tag.aye_supports,
            confidence: tag.confidence,
            source: 'ai',
            rationale: tag.rationale,
          };

          const { error: insertErr } = await db
            .from('division_issue_tags')
            .upsert(row, { onConflict: 'division_id,issue_id' });

          if (insertErr) {
            console.error(`Insert error: ${insertErr.message}`);
          } else {
            totalTagged++;
            // Collect samples for the first ~15
            if (sampleTags.length < 15) {
              const div = subBatch.find((d: any) => d.id === result.division_id);
              sampleTags.push({
                division_title: div?.name ?? result.division_id,
                division_date: div?.date,
                issue: tag.issue_slug,
                aye_supports: tag.aye_supports,
                confidence: tag.confidence,
                rationale: tag.rationale,
              });
            }
          }
        }
      }
    } catch (e) {
      const catchErr = `Sub-batch ${i} error: ${(e as Error).message}`;
      console.error(catchErr);
      errors.push(catchErr);
      continue;
    }
  }

  // ── Distribution across issues ──────────────────────────────────────
  const { data: distribution } = await db
    .from('division_issue_tags')
    .select('issue_id, policy_issues(slug, name)')
    .gte('confidence', 0.6);

  const distMap = new Map<string, number>();
  for (const row of distribution ?? []) {
    const slug = (row as any).policy_issues?.slug ?? 'unknown';
    distMap.set(slug, (distMap.get(slug) ?? 0) + 1);
  }

  return jsonResponse({
    message: `Classified ${batch.length} divisions`,
    total_divisions: allDivisions?.length ?? 0,
    previously_tagged: taggedSet.size,
    batch_processed: batch.length,
    tags_written: totalTagged,
    procedural_skipped: totalSkipped,
    remaining_untagged: untagged.length - batch.length,
    distribution: Object.fromEntries(distMap),
    sample_tags: sampleTags,
    errors: errors.length > 0 ? errors : undefined,
  });
});
