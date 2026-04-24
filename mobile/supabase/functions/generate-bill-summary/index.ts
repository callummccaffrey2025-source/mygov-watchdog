// Supabase Edge Function — generate-bill-summary
//
// Generates a one-sentence plain-English summary and a 2-3 sentence expanded
// summary for a bill using Claude Haiku 4.5.
//
// Can be called with a specific bill_id or in batch mode (no body) to process
// all bills missing summaries.
//
// Deploy:
//   supabase functions deploy generate-bill-summary --project-ref zmmglikiryuftqmoprqm
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-haiku-4-5-20251001';

// Cost control: max bills per invocation, max tokens per call
const MAX_BILLS_PER_RUN = 20;
const MAX_TOKENS = 400;

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

// ── Auth guard: require service role ─────────────────────────────────────────

function isServiceRole(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  return authHeader.includes(SUPABASE_SERVICE_ROLE_KEY);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  // Auth: only service role can trigger this
  if (!isServiceRole(req)) {
    return jsonResponse({ error: 'Unauthorized — service role required' }, 403);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parse optional body for single-bill mode
  let targetBillId: string | null = null;
  try {
    const body = await req.json();
    targetBillId = body?.bill_id ?? null;
  } catch {
    // No body = batch mode
  }

  // Find bills needing summaries
  let query = db
    .from('bills')
    .select('id, title, short_title, summary_full, current_status, categories, date_introduced, chamber_introduced')
    .is('summary_plain', null)
    .neq('current_status', 'Historical')
    .neq('current_status', 'In search index')
    .order('date_introduced', { ascending: false, nullsFirst: false })
    .limit(MAX_BILLS_PER_RUN);

  if (targetBillId) {
    query = db
      .from('bills')
      .select('id, title, short_title, summary_full, current_status, categories, date_introduced, chamber_introduced')
      .eq('id', targetBillId)
      .limit(1);
  }

  const { data: bills, error: fetchError } = await query;
  if (fetchError) {
    return jsonResponse({ error: `Fetch failed: ${fetchError.message}` }, 500);
  }
  if (!bills || bills.length === 0) {
    return jsonResponse({ message: 'No bills need summaries', processed: 0 });
  }

  const results: Array<{ bill_id: string; success: boolean; error?: string }> = [];
  let totalTokens = 0;

  for (const bill of bills) {
    const billContext = [
      `Title: ${bill.title}`,
      bill.short_title ? `Short title: ${bill.short_title}` : null,
      bill.summary_full ? `Official summary: ${bill.summary_full}` : null,
      bill.current_status ? `Current status: ${bill.current_status}` : null,
      bill.categories?.length ? `Topics: ${bill.categories.join(', ')}` : null,
      bill.date_introduced ? `Introduced: ${bill.date_introduced}` : null,
      bill.chamber_introduced ? `Chamber: ${bill.chamber_introduced}` : null,
    ].filter(Boolean).join('\n');

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
          max_tokens: MAX_TOKENS,
          system: `You are a plain-English legislative analyst for an Australian civic app called Verity. Your job is to explain bills so any Australian can understand them in seconds.

Rules:
- Write for a smart 16-year-old who reads the news but doesn't study law
- Never use jargon: say "tax break" not "concession", "landlord" not "lessor"
- Be factual and neutral — no opinion, no editorialising
- If you don't know something, say so — never invent details
- Australian English spelling

Return a JSON object with exactly two fields:
{
  "one_liner": "A single sentence explaining what this bill does. Max 120 characters.",
  "expanded": "2-3 sentences giving slightly more detail — what changes, who's affected, and why it matters. Max 300 characters."
}`,
          messages: [{ role: 'user', content: billContext }],
        }),
      });

      if (!apiResp.ok) {
        results.push({ bill_id: bill.id, success: false, error: `API ${apiResp.status}` });
        continue;
      }

      const data = await apiResp.json();
      const text = data?.content?.[0]?.text?.trim();
      totalTokens += (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0);

      if (!text) {
        results.push({ bill_id: bill.id, success: false, error: 'Empty response' });
        continue;
      }

      // Parse JSON from response (handle markdown code blocks)
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (!parsed.one_liner) {
        results.push({ bill_id: bill.id, success: false, error: 'Missing one_liner' });
        continue;
      }

      // Write back to bills table
      const { error: updateError } = await db
        .from('bills')
        .update({
          summary_plain: parsed.one_liner,
          expanded_summary: parsed.expanded || null,
          summary_generated_at: new Date().toISOString(),
        })
        .eq('id', bill.id);

      if (updateError) {
        results.push({ bill_id: bill.id, success: false, error: updateError.message });
      } else {
        results.push({ bill_id: bill.id, success: true });
      }
    } catch (e: any) {
      results.push({ bill_id: bill.id, success: false, error: e?.message ?? 'Unknown' });
    }
  }

  // Log to pipeline_runs for monitoring
  await db.from('pipeline_runs').insert({
    pipeline_name: 'generate-bill-summary',
    status: results.every(r => r.success) ? 'success' : 'partial',
    details: { processed: results.length, totalTokens, results },
    run_at: new Date().toISOString(),
  }).catch(() => {});

  return jsonResponse({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTokens,
    results,
  });
});
