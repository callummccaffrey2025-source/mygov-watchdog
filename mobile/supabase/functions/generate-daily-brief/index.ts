// generate-daily-brief — recovered from deployed version 10 (2026-06-10 via Supabase MCP)
// Writer model: claude-haiku-4-5. Prompt is mirrored in prompts/daily-brief.md —
// keep them in sync (scripts/check_prompt_drift.py verifies).
// NOTE: this function does NOT fire push notifications. The brief is graded
// post-generation by scripts/grade_brief.py (council gate) in daily_cycle.sh phase 2.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const electorate: string | null = body.electorate ?? null;
  const mpName: string | null = body.mp_name ?? null;
  const electorateKey = electorate ?? "__national__";

  // Today in AEST (UTC+10)
  const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);

  // Return cached brief if it already has AI text
  const { data: existing } = await supabase
    .from("daily_briefs")
    .select("*")
    .eq("date", todayAEST)
    .eq("electorate", electorateKey)
    .maybeSingle();

  if (existing?.ai_text) {
    return new Response(JSON.stringify(existing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Fetch news stories (last 48h, ranked by source count) ────────────
  const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: recentStories } = await supabase
    .from("news_stories")
    .select("headline, article_count, category")
    .gte("first_seen", since48h)
    .order("article_count", { ascending: false })
    .limit(8);

  // Fallback: grab latest stories if not enough recent ones
  const stories = (recentStories && recentStories.length >= 3)
    ? recentStories
    : ((await supabase
        .from("news_stories")
        .select("headline, article_count, category")
        .order("first_seen", { ascending: false })
        .limit(8)
      ).data ?? []);

  // ── Fetch recent parliamentary votes (last 14 days) ──────────────────
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: divisions } = await supabase
    .from("divisions")
    .select("name, date, aye_votes, no_votes, bill_title")
    .gte("date", since14d)
    .order("date", { ascending: false })
    .limit(6);

  // ── Build prompt ──────────────────────────────────────────────────────
  const storiesText = stories.length > 0
    ? stories.map((s: any) =>
        `- "${s.headline}" [${s.category}] — ${s.article_count} source${s.article_count !== 1 ? "s" : ""}`
      ).join("\n")
    : "No recent major political stories available today.";

  const divisionsText = (divisions && divisions.length > 0)
    ? divisions.map((d: any) => {
        const outcome = d.aye_votes > d.no_votes ? "passed" : "defeated";
        // Strip verbose reading labels, shorten name
        const clean = d.name
          .replace(/ — (Second|Third) Reading.*$/i, "")
          .replace(/Bills — /, "")
          .replace(/ - (Second|Third|First) Reading.*$/i, "")
          .trim()
          .slice(0, 80);
        return `- ${clean}: ${outcome} (${d.aye_votes}–${d.no_votes})`;
      }).join("\n")
    : "No recent parliamentary votes.";

  const electorateContext = electorate && mpName
    ? `The reader lives in the ${electorate} electorate, represented by ${mpName} in the House of Representatives.`
    : `This is a national brief for a general Australian audience.`;

  const systemPrompt = `You are a concise, insightful Australian political journalist writing a personalised morning briefing. Write like you're texting a smart friend who doesn't follow politics closely — casual but substantive. No jargon, no waffle. Keep the entire brief under 200 words.

GROUNDING RULES (non-negotiable — your output is independently fact-checked against the records you were given, and a brief that fails is never shown to users):
1. Every factual claim must come from the stories or vote records provided below. No outside facts, no historical comparisons, no statistics you weren't given.
2. Vote records labelled with procedural phrases (Adjourn debate, Reference to Committee, Second Reading, Third Reading, motion) are procedural steps — never describe them as a bill "passing" or "becoming law". Say what actually happened: "moved a step forward", "was sent to committee", "debate was adjourned".
3. Quote vote tallies exactly as given. Never characterise chamber size, margins, or "X couldn't even get Y votes" framing unless the arithmetic is directly in the record.
4. "one_thing_to_know" must be context derivable from the provided evidence — a pattern across the given stories or votes — NOT an invented fact. If no genuine insight exists in the evidence, say something modest and true rather than something interesting and unverified.
5. No partisan framing. Describe what parties did, not who is winning or who is the villain.

Return ONLY valid JSON with exactly these three fields — no preamble, no markdown:
{
  "what_happened": ["one sentence", "one sentence", "one sentence"],
  "what_it_means": "1-2 sentences connecting the news to the reader's situation",
  "one_thing_to_know": "one piece of context grounded in the evidence provided that helps understand the bigger picture"
}`;

  const userPrompt = `${electorateContext}\n\nToday's top news stories:\n${storiesText}\n\nRecent parliamentary votes:\n${divisionsText}\n\nWrite the morning brief now.`;

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData.content?.[0]?.text ?? "";

    // Cost tracking — mirror of scripts/llm_costs.py pricing (haiku 4.5: $1/$5 per MTok).
    // Fire-and-forget: cost logging must never break brief generation.
    try {
      const inputTokens = anthropicData.usage?.input_tokens ?? 0;
      const outputTokens = anthropicData.usage?.output_tokens ?? 0;
      await supabase.from("llm_calls").insert({
        caller: "generate-daily-brief",
        purpose: "daily-brief",
        model: "claude-haiku-4-5-20251001",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000,
      });
    } catch (_) { /* non-fatal */ }

    // Parse JSON — strip any accidental markdown fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${rawText.slice(0, 200)}`);
    const aiText = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(aiText.what_happened) || !aiText.what_it_means || !aiText.one_thing_to_know) {
      throw new Error("AI response missing required fields");
    }

    // Populate legacy stories field from news data for backward compat
    const legacyStories = stories.slice(0, 5).map((s: any) => ({
      headline: s.headline,
      summary: "",
      category: s.category ?? "Politics",
      source_url: null,
      bill_id: null,
    }));

    let savedBrief;
    if (existing) {
      // Update existing row with AI text
      const { data } = await supabase
        .from("daily_briefs")
        .update({ ai_text: aiText, is_personalised: !!electorate })
        .eq("id", existing.id)
        .select()
        .single();
      savedBrief = data;
    } else {
      // Insert new row
      const { data } = await supabase
        .from("daily_briefs")
        .insert({
          date: todayAEST,
          electorate: electorateKey,
          ai_text: aiText,
          is_personalised: !!electorate,
          stories: legacyStories,
          bills_to_watch: [],
          national_updates: [],
        })
        .select()
        .single();
      savedBrief = data;
    }

    console.log(`Brief generated for ${electorateKey} on ${todayAEST}`);

    return new Response(JSON.stringify(savedBrief), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Brief generation failed:", err.message);
    return new Response(
      JSON.stringify({ error: err.message, brief: existing ?? null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
