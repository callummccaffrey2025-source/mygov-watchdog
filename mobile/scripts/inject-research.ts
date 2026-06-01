#!/usr/bin/env npx ts-node
/**
 * inject-research.ts — Inject cached research into a news story's public_sentiment_data.
 *
 * Usage:
 *   npx ts-node scripts/inject-research.ts --story-id=42
 *   npx ts-node scripts/inject-research.ts --story-title="housing affordability"
 *
 * Looks up matching research in scripts/research-cache/, computes divergence_score
 * against the story's existing ai_summary, and writes to news_stories.public_sentiment_data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function computeDivergenceScore(aiSummary: string, sentimentSummary: string): Promise<number> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY || !aiSummary || !sentimentSummary) return 50; // Default medium

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Given this media summary of a story: ${aiSummary}\n\nAnd this public sentiment summary: ${sentimentSummary}\n\nReturn a JSON object with one field: { "divergence_score": <0-100> }\nWhere 0 = public and media are saying the same thing, 100 = completely divergent narratives.\nNo other output.`,
        }],
      }),
    });

    if (!resp.ok) return 50;
    const data = await resp.json();
    const text = data?.content?.[0]?.text || '';
    const match = text.match(/"divergence_score"\s*:\s*(\d+)/);
    return match ? Math.min(100, Math.max(0, parseInt(match[1], 10))) : 50;
  } catch {
    return 50;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let storyId: number | null = null;
  let storyTitle: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--story-id=')) storyId = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--story-title=')) storyTitle = arg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  }

  if (!storyId && !storyTitle) {
    console.error('Usage: npx ts-node scripts/inject-research.ts --story-id=42');
    console.error('   or: npx ts-node scripts/inject-research.ts --story-title="topic"');
    process.exit(1);
  }

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }

  // Find the story
  let storyUrl: string;
  if (storyId) {
    storyUrl = `${SUPABASE_URL}/rest/v1/news_stories?id=eq.${storyId}&select=id,headline,ai_summary&limit=1`;
  } else {
    storyUrl = `${SUPABASE_URL}/rest/v1/news_stories?headline=ilike.%25${encodeURIComponent(storyTitle!)}%25&select=id,headline,ai_summary&limit=1`;
  }

  const storyResp = await fetch(storyUrl, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const stories = await storyResp.json();

  if (!Array.isArray(stories) || stories.length === 0) {
    console.error(`  No story found matching: ${storyId || storyTitle}`);
    process.exit(1);
  }

  const story = stories[0];
  console.log(`\n  Story: "${story.headline}" (id: ${story.id})`);

  // Find matching research cache
  const cacheDir = path.join(__dirname, 'research-cache');
  if (!fs.existsSync(cacheDir)) {
    console.error('  No research cache directory found. Run research first.');
    process.exit(1);
  }

  // Try to find a cache file matching the headline or story title
  const searchTerm = storyTitle || story.headline;
  const slug = slugify(searchTerm);
  const cacheFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));

  // Find best match: exact slug match or most recent file containing similar terms
  let bestFile: string | null = null;
  for (const f of cacheFiles.sort().reverse()) {
    if (f.startsWith(slug)) { bestFile = f; break; }
  }

  // Fallback: find any file with overlapping keywords
  if (!bestFile) {
    const keywords = searchTerm.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    for (const f of cacheFiles.sort().reverse()) {
      if (keywords.some((kw: string) => f.includes(kw))) { bestFile = f; break; }
    }
  }

  if (!bestFile) {
    console.error(`  No research cache found for "${searchTerm}". Run: ./scripts/research.sh story "${searchTerm}"`);
    process.exit(1);
  }

  console.log(`  Cache: ${bestFile}`);
  const research = JSON.parse(fs.readFileSync(path.join(cacheDir, bestFile), 'utf-8'));

  // Compute divergence score
  console.log('  Computing divergence score...');
  const divergenceScore = await computeDivergenceScore(
    story.ai_summary || '',
    research.public_sentiment_summary || '',
  );

  // Build the JSONB payload
  const sentimentData = {
    sentiment_summary: research.public_sentiment_summary,
    reddit_signal: research.reddit_signal,
    best_takes: research.best_takes || [],
    ran_at: research.ran_at,
    divergence_score: divergenceScore,
  };

  // Write to Supabase
  const updateUrl = `${SUPABASE_URL}/rest/v1/news_stories?id=eq.${story.id}`;
  const updateResp = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ public_sentiment_data: sentimentData }),
  });

  if (updateResp.ok) {
    console.log(`  Done! Injected public_sentiment_data (divergence: ${divergenceScore}/100)`);
    console.log(`  ${divergenceScore > 70 ? 'HIGH' : divergenceScore > 40 ? 'MEDIUM' : 'LOW'} divergence between media and public sentiment.`);
  } else {
    const err = await updateResp.text();
    console.error(`  Failed: ${updateResp.status} ${err}`);
  }
  console.log('');
}

main().catch(console.error);
