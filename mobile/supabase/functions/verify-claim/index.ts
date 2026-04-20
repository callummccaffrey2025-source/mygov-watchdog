// Supabase Edge Function — verify-claim
//
// Receives an MP, claim, and a list of voting records, and returns a
// neutral 2-3 sentence AI verdict from Claude Haiku 4.5.
//
// Deploy:
//   supabase functions deploy verify-claim --project-ref zmmglikiryuftqmoprqm
//
// Set the Anthropic key (one time):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref zmmglikiryuftqmoprqm
//
// Request body:
//   { mpName: string, claim: string, votes: Array<{ name: string, vote: string, date?: string }> }
//
// Response:
//   { verdict: string }
//   { error: string } (on failure)
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CLAIMS_PER_DAY = 10;

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
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  // ── Auth: require authenticated user ──────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  // ── Rate limit: max 10 claims per user per day ────────────────────────
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { count } = await db
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('event_name', 'verify_claim')
    .gte('created_at', today + 'T00:00:00');

  if ((count ?? 0) >= MAX_CLAIMS_PER_DAY) {
    return jsonResponse({
      error: `Rate limit exceeded — maximum ${MAX_CLAIMS_PER_DAY} claim verifications per day`,
    }, 429);
  }

  // Log this claim for rate limiting
  await db.from('analytics_events').insert({
    user_id: user.id,
    event_name: 'verify_claim',
    event_data: {},
  }).catch(() => {});

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { mpName, claim, votes } = body ?? {};
  if (!mpName || !claim || !Array.isArray(votes) || votes.length === 0) {
    return jsonResponse({ error: 'mpName, claim, and votes[] required' }, 400);
  }

  // Build the prompt
  const voteLines = votes.slice(0, 5).map((v: any) => {
    const name = (v.name ?? 'Unknown division').toString();
    const vote = (v.vote ?? '').toString().toUpperCase();
    const date = v.date ? ` (${v.date})` : '';
    return `- ${vote}: ${name}${date}`;
  }).join('\n');

  const userMessage =
    `A citizen asks: "${claim}"\n\n` +
    `Based on these voting records by ${mpName}, give a clear 2-3 sentence verdict. ` +
    `Be direct. Cite specific bills and dates where useful. Do not editorialise.\n\n` +
    `Voting records:\n${voteLines}`;

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
        max_tokens: 300,
        system: 'You are a neutral fact-checker for an Australian civic intelligence app. Respond in 2-3 plain-English sentences with no editorialising.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return jsonResponse({ error: `Anthropic API error: ${apiResp.status} ${errText}` }, 502);
    }

    const data = await apiResp.json();
    const verdict = data?.content?.[0]?.text?.trim() ?? null;
    if (!verdict) {
      return jsonResponse({ error: 'Empty AI response' }, 502);
    }

    return jsonResponse({ verdict });
  } catch (e) {
    return jsonResponse({ error: `Internal error: ${(e as Error).message}` }, 500);
  }
});
