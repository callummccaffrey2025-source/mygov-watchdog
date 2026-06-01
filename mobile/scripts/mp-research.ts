#!/usr/bin/env npx ts-node
/**
 * mp-research.ts — Research public discourse about an MP and store to Supabase.
 *
 * Usage:
 *   npx ts-node scripts/mp-research.ts "Anthony Albanese"
 *   npx ts-node scripts/mp-research.ts "Jerome Laxale"
 *
 * Reads from research cache if available, otherwise generates placeholder.
 * Writes result to members.public_discourse_data in Supabase.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

interface MPDiscourseData {
  sentiment_summary: string;
  reddit_signal: string;
  x_signal: string;
  best_takes: string[];
  sources_searched: string[];
  ran_at: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function main() {
  const mpName = process.argv.slice(2).join(' ').trim();

  if (!mpName) {
    console.error('Usage: npx ts-node scripts/mp-research.ts "MP Full Name"');
    process.exit(1);
  }

  console.log(`\n  Researching MP: "${mpName}"\n`);

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('  Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
  }

  // Check if research cache exists for this MP
  const cacheDir = path.join(__dirname, 'research-cache');
  const today = new Date().toISOString().split('T')[0];
  const cacheFile = path.join(cacheDir, `${slugify(mpName)}-${today}.json`);

  let discourseData: MPDiscourseData;

  if (fs.existsSync(cacheFile)) {
    console.log(`  Found cached research: ${cacheFile}`);
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    discourseData = {
      sentiment_summary: cached.public_sentiment_summary || '',
      reddit_signal: cached.reddit_signal || '',
      x_signal: cached.x_signal || '',
      best_takes: cached.best_takes || [],
      sources_searched: cached.sources_searched || [],
      ran_at: cached.ran_at || new Date().toISOString(),
    };
  } else {
    console.log('  No cache found. Running research script first...');
    try {
      execSync(`npx ts-node "${path.join(__dirname, 'last30days-research.ts')}" "${mpName}"`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
      // Re-read cache
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        discourseData = {
          sentiment_summary: cached.public_sentiment_summary || '',
          reddit_signal: cached.reddit_signal || '',
          x_signal: cached.x_signal || '',
          best_takes: cached.best_takes || [],
          sources_searched: cached.sources_searched || [],
          ran_at: cached.ran_at || new Date().toISOString(),
        };
      } else {
        discourseData = {
          sentiment_summary: `Research pending for ${mpName}. Run /last30days "${mpName}" in Claude Code and paste output.`,
          reddit_signal: '',
          x_signal: '',
          best_takes: [],
          sources_searched: [],
          ran_at: new Date().toISOString(),
        };
      }
    } catch {
      discourseData = {
        sentiment_summary: `Research pending for ${mpName}.`,
        reddit_signal: '',
        x_signal: '',
        best_takes: [],
        sources_searched: [],
        ran_at: new Date().toISOString(),
      };
    }
  }

  // Write to Supabase
  console.log(`\n  Writing to members.public_discourse_data...`);

  // Find the member by name
  const searchUrl = `${SUPABASE_URL}/rest/v1/members?or=(last_name.ilike.%25${encodeURIComponent(mpName.split(' ').pop() || '')}%25)&is_active=eq.true&select=id,first_name,last_name&limit=5`;
  const searchResp = await fetch(searchUrl, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const members = await searchResp.json();

  if (!Array.isArray(members) || members.length === 0) {
    console.error(`  No active member found matching "${mpName}"`);
    process.exit(1);
  }

  // Find best match
  const fullNameLower = mpName.toLowerCase();
  const match = members.find((m: any) =>
    `${m.first_name} ${m.last_name}`.toLowerCase() === fullNameLower
  ) || members[0];

  console.log(`  Matched: ${match.first_name} ${match.last_name} (${match.id})`);

  // Update the member record
  const updateUrl = `${SUPABASE_URL}/rest/v1/members?id=eq.${match.id}`;
  const updateResp = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      public_discourse_data: discourseData,
      public_discourse_updated_at: new Date().toISOString(),
    }),
  });

  if (updateResp.ok) {
    console.log(`  Done! Updated public_discourse_data for ${match.first_name} ${match.last_name}`);
  } else {
    const err = await updateResp.text();
    console.error(`  Failed to update: ${updateResp.status} ${err}`);
  }

  // Print summary
  console.log('\n  ── Discourse Summary ──────────────────────────────');
  console.log(`  ${discourseData.sentiment_summary.slice(0, 300)}`);
  if (discourseData.best_takes.length > 0) {
    console.log(`\n  Best takes:`);
    discourseData.best_takes.slice(0, 3).forEach((t, i) => console.log(`    ${i + 1}. "${t.slice(0, 100)}"`));
  }
  console.log('');
}

main().catch(console.error);
