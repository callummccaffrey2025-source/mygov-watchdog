// Supabase Edge Function — generate-daily-poll
//
// AI generates exactly one poll per day from top Australian political news.
// Three non-negotiable guardrails enforced:
//   1. POLICY ONLY — never about groups of people
//   2. SOURCE GROUNDED — must cite a real, recent article
//   3. POLICY VS PERSON — binary about a decision, not a value judgement
//
// Schedule via pg_cron at 6am AEST (20:00 UTC):
//   SELECT cron.schedule('generate-daily-poll', '0 20 * * *', $$...$$);
//
// Deploy:
//   supabase functions deploy generate-daily-poll --project-ref zmmglikiryuftqmoprqm

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const MAX_RETRIES = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SYSTEM_PROMPT = `You generate one daily poll question for Verity, an Australian civic intelligence app.

THREE NON-NEGOTIABLE GUARDRAILS:

GUARDRAIL 1 — POLICY ONLY:
Polls must be about policies, decisions, government actions, bills, votes, or specific proposals. Never about groups of people.
FORBIDDEN: polls about identity, race, religion, ethnicity, sexuality, gender, or judging categories of people.
ACCEPTABLE: "Should the Australian government raise the JobSeeker payment?" or "Should Australia adopt nuclear power?"
FORBIDDEN: "Should immigration be reduced?" (rephrase as "Should the immigration cap be reduced from X to Y?") or "Are migrants good for Australia?"

GUARDRAIL 2 — SOURCE GROUNDED:
The poll MUST reference a specific real news article. You must return the article URL, title, outlet name, and publication date. If you cannot identify a real source from the provided stories, return null.

GUARDRAIL 3 — POLICY VS PERSON FRAMING:
The poll must be phrased as a binary about a decision, not a value judgement.
GOOD: "Should the government do X?"
BORDERLINE: "Was the government right to do X?" (avoid)
FORBIDDEN: "Is the government bad for doing X?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "question": "Should Australia...",
  "option_a": "Yes — [brief reasoning]",
  "option_b": "No — [brief reasoning]",
  "source_url": "https://...",
  "source_title": "Article headline",
  "source_outlet": "Outlet name",
  "source_published_at": "2026-04-30T...",
  "guardrail_check": {
    "passes_policy_only": true,
    "passes_source_grounded": true,
    "passes_framing": true,
    "reasoning": "This polls a specific policy proposal..."
  }
}

If you cannot generate a valid poll that passes all three guardrails, return:
{"skip": true, "reason": "..."}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Target date: today in AEST
  const now = new Date();
  const aestOffset = 10 * 60 * 60 * 1000;
  const aestNow = new Date(now.getTime() + aestOffset);
  const targetDate = aestNow.toISOString().slice(0, 10);

  // Check if poll already exists for today
  const { data: existing } = await db
    .from('daily_polls')
    .select('id')
    .eq('publish_date', targetDate)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ message: 'Poll already exists for today', date: targetDate, poll_id: existing.id });
  }

  // Fetch top news stories from the last 48 hours
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: stories } = await db
    .from('news_stories')
    .select('headline, ai_summary, category, article_count, first_seen')
    .gte('first_seen', cutoff)
    .order('article_count', { ascending: false })
    .limit(10);

  if (!stories || stories.length === 0) {
    return jsonResponse({ skip: true, reason: 'No recent news stories to base a poll on', date: targetDate });
  }

  // Build context for AI
  const storiesContext = stories.map((s: any, i: number) =>
    `${i + 1}. "${s.headline}" (${s.article_count} outlets, ${s.category ?? 'general'}, ${s.first_seen})\n   ${s.ai_summary ?? ''}`
  ).join('\n\n');

  let poll: any = null;
  let totalTokens = 0;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const userMessage = attempt === 1
        ? `Today is ${targetDate}. Here are the top Australian political stories from the last 48 hours:\n\n${storiesContext}\n\nGenerate today's poll based on the most significant policy story.`
        : `Previous attempt failed guardrails. Try a DIFFERENT story from the list. Attempt ${attempt}/${MAX_RETRIES}.\n\n${storiesContext}`;

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
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!apiResp.ok) {
        const errText = await apiResp.text();
        console.error(`Anthropic API error (attempt ${attempt}):`, errText);
        continue;
      }

      const data = await apiResp.json();
      totalTokens += (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0);

      let text = data?.content?.[0]?.text?.trim() ?? '';
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(text);

      // Skip response
      if (parsed.skip) {
        console.log(`AI skipped (attempt ${attempt}):`, parsed.reason);
        continue;
      }

      // Validate guardrails
      const check = parsed.guardrail_check;
      if (!check?.passes_policy_only || !check?.passes_source_grounded || !check?.passes_framing) {
        console.log(`Guardrail failed (attempt ${attempt}):`, check?.reasoning);
        continue;
      }

      // Validate required fields
      if (!parsed.question || !parsed.option_a || !parsed.option_b || !parsed.source_url) {
        console.log(`Missing fields (attempt ${attempt})`);
        continue;
      }

      poll = parsed;
      break;

    } catch (e: any) {
      console.error(`Parse error (attempt ${attempt}):`, e.message);
      continue;
    }
  }

  if (!poll) {
    return jsonResponse({
      skip: true,
      reason: `Failed to generate valid poll after ${MAX_RETRIES} attempts`,
      date: targetDate,
      tokens_used: totalTokens,
    });
  }

  // Insert the poll
  const resolveTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: inserted, error: insertErr } = await db
    .from('daily_polls')
    .insert({
      publish_date: targetDate,
      question: poll.question,
      option_a_text: poll.option_a,
      option_b_text: poll.option_b,
      source_article_url: poll.source_url,
      source_article_title: poll.source_title ?? null,
      source_article_outlet: poll.source_outlet ?? null,
      source_article_published_at: poll.source_published_at ?? null,
      ai_generation_metadata: {
        model: MODEL,
        tokens_used: totalTokens,
        guardrail_check: poll.guardrail_check,
        generated_at: now.toISOString(),
      },
      status: 'published',
      published_at: now.toISOString(),
      resolves_at: resolveTime.toISOString(),
    })
    .select()
    .single();

  if (insertErr) {
    return jsonResponse({ error: `Insert failed: ${insertErr.message}` }, 500);
  }

  return jsonResponse({
    success: true,
    date: targetDate,
    poll_id: inserted.id,
    question: poll.question,
    source: poll.source_url,
    tokens_used: totalTokens,
    cost_estimate: `$${(totalTokens * 0.00000125).toFixed(4)}`,
  });
});
