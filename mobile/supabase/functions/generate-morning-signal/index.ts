// Supabase Edge Function — generate-morning-signal
//
// Generates a daily Morning Signal briefing using Claude Haiku 4.5.
// Gathers top stories, rebellions, bill movements, and blindspots from Supabase,
// then calls Anthropic to produce structured JSON for the 5 signal sections.
//
// Deploy:
//   supabase functions deploy generate-morning-signal --project-ref zmmglikiryuftqmoprqm
//
// Set the Anthropic key (one time):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref zmmglikiryuftqmoprqm
//
// Request body:
//   { electorate?: string, mp_name?: string }
//
// Response:
//   MorningSignalData object (inserted into morning_signals table)
//   { error: string } (on failure)
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
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // No body is fine — we'll generate a national signal
  }

  const electorate: string = body?.electorate ?? '__national__';
  const mpName: string | null = body?.mp_name ?? null;

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterdayAEST = new Date(Date.now() + 10 * 3600 * 1000 - 86400 * 1000).toISOString().slice(0, 10);

  // ── Check if signal already exists for this date + electorate ──────────
  const { data: existing } = await db
    .from('morning_signals')
    .select('*')
    .eq('date', todayAEST)
    .eq('electorate', electorate)
    .maybeSingle();

  if (existing) {
    return jsonResponse(existing);
  }

  // ── Gather data ────────────────────────────────────────────────────────

  // 1. Top 5 stories from last 24h by article count
  const { data: topStories } = await db
    .from('news_stories')
    .select('id, title, summary, article_count, ai_summary')
    .gte('created_at', yesterdayAEST + 'T00:00:00')
    .order('article_count', { ascending: false })
    .limit(5);

  // 2. Rebellions from last 24h
  const { data: rebellions } = await db
    .from('division_votes')
    .select('member_id, vote, divisions(id, name, date, bill_id), members(first_name, last_name, party)')
    .eq('rebelled', true)
    .gte('divisions.date', yesterdayAEST)
    .limit(10);

  // 3. Bill movements — bills updated since yesterday
  const { data: billMovements } = await db
    .from('bills')
    .select('id, title, short_title, current_status, status, last_updated')
    .gte('last_updated', yesterdayAEST + 'T00:00:00')
    .order('last_updated', { ascending: false })
    .limit(5);

  // 4. Blindspot — story with highest article_count that has blindspot data
  const { data: blindspotStories } = await db
    .from('news_stories')
    .select('id, title, blindspot, article_count')
    .not('blindspot', 'is', null)
    .gte('created_at', yesterdayAEST + 'T00:00:00')
    .order('article_count', { ascending: false })
    .limit(1);

  // 5. Electorate-specific: user's MP's recent votes + speeches
  let electorateContext = '';
  if (electorate !== '__national__' && mpName) {
    const { data: mpVotes } = await db
      .from('division_votes')
      .select('vote, divisions(name, date, bill_id)')
      .eq('members.last_name', mpName.split(' ').pop() ?? '')
      .order('divisions.date', { ascending: false } as any)
      .limit(5);

    if (mpVotes && mpVotes.length > 0) {
      electorateContext = `\n\nELECTORATE DATA (${electorate}, MP: ${mpName}):\n` +
        mpVotes.map((v: any) => `- ${v.vote}: ${(v.divisions as any)?.name ?? 'Unknown'} (${(v.divisions as any)?.date ?? ''})`).join('\n');
    }
  }

  // ── Build prompt data ─────────────────────────────────────────────────
  const storiesText = (topStories ?? []).map((s: any) =>
    `[story_id: ${s.id}] "${s.title}" — ${s.article_count} sources. ${s.ai_summary ?? s.summary ?? ''}`
  ).join('\n');

  const rebellionsText = (rebellions ?? []).length > 0
    ? (rebellions ?? []).map((r: any) => {
        const m = r.members as any;
        const d = r.divisions as any;
        return `[member_id: ${r.member_id}] ${m?.first_name ?? ''} ${m?.last_name ?? ''} (${m?.party ?? ''}) voted ${r.vote} on "${d?.name ?? 'Unknown'}" (${d?.date ?? ''})`;
      }).join('\n')
    : 'No rebellions in the last 24 hours.';

  const billsText = (billMovements ?? []).length > 0
    ? (billMovements ?? []).map((b: any) =>
        `[bill_id: ${b.id}] "${b.short_title ?? b.title}" — status: ${b.current_status ?? b.status ?? 'unknown'}`
      ).join('\n')
    : 'No bill movements in the last 24 hours.';

  const blindspotText = (blindspotStories ?? []).length > 0
    ? `[story_id: ${(blindspotStories as any)[0].id}] "${(blindspotStories as any)[0].title}" — blindspot: ${JSON.stringify((blindspotStories as any)[0].blindspot)}`
    : 'No blindspot stories detected.';

  const userMessage =
    `Generate the Morning Signal for ${todayAEST}.\n\n` +
    `TOP STORIES:\n${storiesText}\n\n` +
    `REBELLIONS:\n${rebellionsText}\n\n` +
    `BILL MOVEMENTS:\n${billsText}\n\n` +
    `BLINDSPOT DATA:\n${blindspotText}` +
    electorateContext;

  const systemPrompt =
    `You write Verity's Morning Signal — a daily civic intelligence briefing for politically-literate Australians.\n\n` +
    `Rules:\n` +
    `- Direct, factual, no editorialising\n` +
    `- Every claim references a source_id from the data provided\n` +
    `- Never say "we" or "I"\n` +
    `- If a section has no data, write "Nothing to report today"\n` +
    `- Banned editorial terms: caves, radical, slammed, destroyed, blasted\n\n` +
    `Generate 5 sections from this data:\n` +
    `1. TOP STORIES (3 max): Stories that changed something. Each must reference a story_id.\n` +
    `2. SHIFTED POSITIONS: MPs whose votes contradicted expectations. Include member_id.\n` +
    `3. BILL MOVEMENTS: Bills that advanced stages. Include bill_id.\n` +
    `4. BLINDSPOT: One topic only one political side covered.\n` +
    `5. YOUR ELECTORATE: What this means for the specified electorate (or omit if national).\n\n` +
    `Return JSON matching this schema:\n` +
    `{\n` +
    `  "top_stories": [{"story_id": number, "headline": string, "why_it_matters": string}],\n` +
    `  "shifted_positions": [{"member_id": string, "member_name": string, "old_position": string, "new_position": string}],\n` +
    `  "bill_movements": [{"bill_id": string, "bill_title": string, "from_stage": string, "to_stage": string}],\n` +
    `  "blindspot": {"topic": string, "gap_side": "left"|"right", "story_ids": [number]},\n` +
    `  "electorate_impact": string\n` +
    `}\n\n` +
    `Return ONLY valid JSON. No markdown fences. No extra text.`;

  // ── Call Claude Haiku 4.5 ──────────────────────────────────────────────
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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      return jsonResponse({ error: `Anthropic API error: ${apiResp.status} ${errText}` }, 502);
    }

    const data = await apiResp.json();
    const rawText = data?.content?.[0]?.text?.trim() ?? null;
    if (!rawText) {
      return jsonResponse({ error: 'Empty AI response' }, 502);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse({ error: 'AI returned invalid JSON' }, 502);
    }

    // ── Build the signal row ────────────────────────────────────────────
    const signalRow = {
      date: todayAEST,
      electorate,
      top_stories: (parsed.top_stories ?? []).map((s: any) => ({
        story_id: s.story_id,
        headline: s.headline,
        why_it_matters: s.why_it_matters,
        source_ids: [],
      })),
      shifted_positions: parsed.shifted_positions?.length
        ? parsed.shifted_positions.map((sp: any) => ({
            member_id: String(sp.member_id),
            member_name: sp.member_name,
            old_position: sp.old_position,
            new_position: sp.new_position,
            evidence_id: '',
          }))
        : null,
      bill_movements: parsed.bill_movements?.length
        ? parsed.bill_movements.map((bm: any) => ({
            bill_id: String(bm.bill_id),
            bill_title: bm.bill_title,
            from_stage: bm.from_stage,
            to_stage: bm.to_stage,
          }))
        : null,
      blindspot: parsed.blindspot?.topic
        ? {
            topic: parsed.blindspot.topic,
            gap_side: parsed.blindspot.gap_side ?? 'left',
            story_ids: parsed.blindspot.story_ids ?? [],
          }
        : null,
      electorate_impact: parsed.electorate_impact ?? null,
    };

    // ── Insert into morning_signals ─────────────────────────────────────
    const { data: inserted, error: insertErr } = await db
      .from('morning_signals')
      .insert(signalRow)
      .select()
      .single();

    if (insertErr) {
      return jsonResponse({ error: `DB insert failed: ${insertErr.message}` }, 500);
    }

    return jsonResponse(inserted);
  } catch (e) {
    return jsonResponse({ error: `Internal error: ${(e as Error).message}` }, 500);
  }
});
