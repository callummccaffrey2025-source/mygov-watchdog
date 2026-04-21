// Supabase Edge Function — generate-relevance-line
//
// Generates a single sentence (8-20 words) explaining why a piece of
// content personally matters to a specific user.
//
// Deploy:
//   supabase functions deploy generate-relevance-line --project-ref zmmglikiryuftqmoprqm
//
// Request body:
//   { user_id: string, content_type: 'story' | 'bill' | 'vote', content_id: string }
//
// Response:
//   { relevance_line: string | null }
//   { error: string } (on failure)
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_GENERATIONS_PER_DAY = 50;

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

// Simple hash for profile-based cache key
async function computeProfileHash(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { content_type, content_id } = body ?? {};
  const userId = user.id;

  if (!content_type || !content_id) {
    return jsonResponse({ error: 'content_type and content_id required' }, 400);
  }
  if (!['story', 'bill', 'vote'].includes(content_type)) {
    return jsonResponse({ error: 'content_type must be story, bill, or vote' }, 400);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Fetch user profile ────────────────────────────────────────────────
  const { data: profile } = await db
    .from('user_preferences')
    .select('postcode, electorate, state, selected_topics, tracked_issues, housing_status, age_bracket, income_bracket')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ relevance_line: null });
  }

  const electorate = profile.electorate ?? '';
  const topics = Array.isArray(profile.selected_topics) ? profile.selected_topics.join(',') : '';
  const housingStatus = profile.housing_status ?? '';

  // ── Compute profile hash and check cache ──────────────────────────────
  const profileHash = await computeProfileHash([
    userId,
    electorate,
    topics,
    housingStatus,
  ]);

  const { data: cached } = await db
    .from('relevance_cache')
    .select('relevance_line, created_at')
    .eq('profile_hash', profileHash)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .maybeSingle();

  if (cached) {
    // Cache valid for 7 days
    const age = Date.now() - new Date(cached.created_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ relevance_line: cached.relevance_line });
    }
  }

  // ── Rate limit: max generations per user per day ──────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const { count } = await db
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_name', 'generate_relevance')
    .gte('created_at', today + 'T00:00:00');

  if ((count ?? 0) >= MAX_GENERATIONS_PER_DAY) {
    // Fallback: template-based line
    const trackedIssues = Array.isArray(profile.tracked_issues) ? profile.tracked_issues : [];
    const fallbackIssue = trackedIssues.length > 0 ? trackedIssues[0] : 'Australian politics';
    return jsonResponse({
      relevance_line: `Related to your interest in ${fallbackIssue}`,
      fallback: true,
    });
  }

  // ── Fetch content details ─────────────────────────────────────────────
  let contentSummary = '';

  if (content_type === 'story') {
    const { data: story } = await db
      .from('news_stories')
      .select('headline, category, ai_summary')
      .eq('id', content_id)
      .maybeSingle();
    if (!story) return jsonResponse({ relevance_line: null });
    contentSummary = `News story: "${story.headline}" (category: ${story.category ?? 'general'}). ${story.ai_summary ?? ''}`.trim();
  } else if (content_type === 'bill') {
    const { data: bill } = await db
      .from('bills')
      .select('name, description')
      .eq('id', content_id)
      .maybeSingle();
    if (!bill) return jsonResponse({ relevance_line: null });
    contentSummary = `Bill: "${bill.name}". ${bill.description ?? ''}`.trim();
  } else if (content_type === 'vote') {
    const { data: division } = await db
      .from('divisions')
      .select('name, date, motion')
      .eq('id', content_id)
      .maybeSingle();
    if (!division) return jsonResponse({ relevance_line: null });
    contentSummary = `Parliamentary vote: "${division.name}" (${division.date ?? ''}). ${division.motion ?? ''}`.trim();
  }

  // ── Log for rate limiting ─────────────────────────────────────────────
  await db.from('analytics_events').insert({
    user_id: userId,
    event_name: 'generate_relevance',
    event_data: { content_type, content_id },
  }).catch(() => {});

  // ── Build prompt and call Claude ──────────────────────────────────────
  const userProfileSummary = [
    profile.postcode && `Postcode: ${profile.postcode}`,
    profile.electorate && `Electorate: ${profile.electorate}`,
    profile.state && `State: ${profile.state}`,
    topics && `Interested in: ${topics}`,
    profile.housing_status && `Housing: ${profile.housing_status}`,
    profile.age_bracket && `Age: ${profile.age_bracket}`,
    profile.income_bracket && `Income: ${profile.income_bracket}`,
  ].filter(Boolean).join('. ');

  const userMessage =
    `User profile: ${userProfileSummary || 'No profile details available'}\n\n` +
    `Content: ${contentSummary}`;

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
        max_tokens: 100,
        system: 'Generate one sentence (8-20 words) explaining why this Australian political content personally affects this user. Be specific, not generic. Reference their actual situation. If no genuine personal connection exists, respond with just "null".\n\nNever fabricate a connection. "This affects you" is useless. "This raises your weekly rent cap by $40" is useful.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return jsonResponse({ error: `Anthropic API error: ${apiResp.status} ${errText}` }, 502);
    }

    const data = await apiResp.json();
    const rawLine = data?.content?.[0]?.text?.trim() ?? null;
    const inputTokens = data?.usage?.input_tokens ?? 0;
    const outputTokens = data?.usage?.output_tokens ?? 0;

    // Check if the model returned "null" (no genuine connection)
    if (!rawLine || rawLine.toLowerCase() === 'null') {
      return jsonResponse({ relevance_line: null, tokens: { input: inputTokens, output: outputTokens } });
    }

    // ── Cache the result ──────────────────────────────────────────────────
    await db.from('relevance_cache').upsert({
      profile_hash: profileHash,
      content_type,
      content_id,
      relevance_line: rawLine,
      user_id: userId,
    }, {
      onConflict: 'profile_hash,content_type,content_id',
    }).catch(() => {});

    return jsonResponse({
      relevance_line: rawLine,
      tokens: { input: inputTokens, output: outputTokens },
    });
  } catch (e) {
    return jsonResponse({ error: `Internal error: ${(e as Error).message}` }, 500);
  }
});
