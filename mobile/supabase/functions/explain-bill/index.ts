// Supabase Edge Function — explain-bill
//
// Generates a rich plain-English explainer for a bill and caches it in
// bills_plain_english. Returns cached version if already generated.
// Called on-demand from the client when viewing a bill detail.
//
// Request body: { bill_id: string }
// Response: { summary_3line, what_it_changes_for_you, caveats, cached: boolean }
//
// Deploy:
//   supabase functions deploy explain-bill --project-ref zmmglikiryuftqmoprqm
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-haiku-4-5-20251001';

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let billId: string;
  try {
    const body = await req.json();
    billId = body?.bill_id;
    if (!billId) return jsonResponse({ error: 'bill_id required' }, 400);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check cache first
  const { data: cached } = await db
    .from('bills_plain_english')
    .select('summary_3line, what_it_changes_for_you, caveats')
    .eq('bill_id', billId)
    .maybeSingle();

  if (cached) {
    return jsonResponse({ ...cached, cached: true });
  }

  // Not cached — generate
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  // Load bill context
  const { data: bill, error: billErr } = await db
    .from('bills')
    .select('id, title, short_title, summary_full, summary_plain, current_status, date_introduced, sponsor, portfolio, bill_type')
    .eq('id', billId)
    .single();

  if (billErr || !bill) {
    return jsonResponse({ error: 'Bill not found' }, 404);
  }

  const billContext = [
    `Title: ${bill.title}`,
    bill.short_title ? `Short title: ${bill.short_title}` : null,
    bill.summary_full ? `Official summary: ${bill.summary_full}` : null,
    bill.summary_plain ? `One-line summary: ${bill.summary_plain}` : null,
    bill.current_status ? `Status: ${bill.current_status}` : null,
    bill.date_introduced ? `Introduced: ${bill.date_introduced}` : null,
    bill.sponsor ? `Sponsor: ${bill.sponsor}` : null,
    bill.portfolio ? `Portfolio: ${bill.portfolio}` : null,
    bill.bill_type ? `Type: ${bill.bill_type}` : null,
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
        max_tokens: 600,
        system: `You are a plain-English legislative explainer for Verity, an Australian civic intelligence app. Your job is to make any bill understandable in seconds.

Rules:
- Write for a smart 16-year-old who reads the news but doesn't study law
- Never use jargon: say "tax break" not "concession", "landlord" not "lessor"
- Be factual and neutral — no opinion, no editorialising about named people
- If you don't know something, say so — never invent details
- Australian English spelling

Return a JSON object with exactly three fields:
{
  "summary_3line": "Three short sentences explaining what this bill does, in plain English. What is it? What does it change? Who does it affect?",
  "what_it_changes_for_you": "One sentence about how this could affect an ordinary Australian. Be specific and practical, not abstract. If unclear, say 'The direct impact on most Australians is unclear.'",
  "caveats": "One sentence noting any important context, limitations, or things the summary simplifies. E.g. 'This bill is still in committee and may change significantly.'"
}`,
        messages: [{ role: 'user', content: billContext }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return jsonResponse({ error: `AI generation failed: ${apiResp.status}` }, 502);
    }

    const data = await apiResp.json();
    const text = data?.content?.[0]?.text?.trim() ?? '';
    const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);

    if (!parsed.summary_3line) {
      return jsonResponse({ error: 'AI returned invalid format' }, 502);
    }

    // Cache to database
    await db.from('bills_plain_english').upsert({
      bill_id: billId,
      summary_3line: parsed.summary_3line,
      what_it_changes_for_you: parsed.what_it_changes_for_you ?? null,
      caveats: parsed.caveats ?? null,
      model: MODEL,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'bill_id' });

    return jsonResponse({
      summary_3line: parsed.summary_3line,
      what_it_changes_for_you: parsed.what_it_changes_for_you ?? null,
      caveats: parsed.caveats ?? null,
      cached: false,
    });
  } catch (e: any) {
    return jsonResponse({ error: `Generation failed: ${e?.message}` }, 500);
  }
});
