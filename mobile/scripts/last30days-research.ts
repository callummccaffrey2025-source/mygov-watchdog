#!/usr/bin/env npx ts-node
/**
 * last30days-research.ts — Run /last30days research on a topic and cache structured output.
 *
 * Usage:
 *   npx ts-node scripts/last30days-research.ts "housing affordability"
 *   npx ts-node scripts/last30days-research.ts "Anthony Albanese" --for-brief
 *
 * Output: scripts/research-cache/[topic-slug]-[date].json
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ResearchOutput {
  topic: string;
  ran_at: string;
  reddit_signal: string;
  x_signal: string;
  youtube_signal: string;
  polymarket_signal: string;
  public_sentiment_summary: string;
  best_takes: string[];
  sources_searched: string[];
  raw_output?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function extractSection(text: string, header: string): string {
  const headerPattern = new RegExp(`(?:^|\\n)(?:#+\\s*)?${header}[:\\s]*\\n([\\s\\S]*?)(?=\\n(?:#+|---)|$)`, 'i');
  const match = text.match(headerPattern);
  if (match) return match[1].trim();

  // Fallback: look for the header as a bold or plain label
  const altPattern = new RegExp(`\\*\\*${header}\\*\\*[:\\s]*([^\\n]+)`, 'i');
  const altMatch = text.match(altPattern);
  return altMatch ? altMatch[1].trim() : '';
}

function extractBestTakes(text: string): string[] {
  const takes: string[] = [];
  // Look for quoted text with engagement signals
  const quotePattern = /[""\u201C]([^""\u201D]{20,200})[""\u201D](?:\s*[-\u2014]\s*([^\n]{5,80}))?/g;
  let match: RegExpExecArray | null;
  while ((match = quotePattern.exec(text)) !== null && takes.length < 5) {
    const attribution = match[2] ? ` — ${match[2]}` : '';
    takes.push(`${match[1]}${attribution}`);
  }

  // Fallback: bullet points under "Best Takes" or "Top Reactions"
  if (takes.length === 0) {
    const bulletSection = extractSection(text, 'Best Takes') || extractSection(text, 'Top Reactions');
    if (bulletSection) {
      const bullets = bulletSection.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
      for (const b of bullets.slice(0, 5)) {
        takes.push(b.replace(/^[-*]\s*/, '').trim());
      }
    }
  }
  return takes.slice(0, 5);
}

function extractSourcesSearched(text: string): string[] {
  const sources: string[] = [];
  const platforms = ['Reddit', 'X', 'Twitter', 'YouTube', 'Hacker News', 'HN', 'Polymarket', 'TikTok', 'GitHub', 'Web'];
  for (const p of platforms) {
    if (text.toLowerCase().includes(p.toLowerCase())) {
      sources.push(p === 'HN' ? 'Hacker News' : p === 'Twitter' ? 'X' : p);
    }
  }
  return Array.from(new Set(sources));
}

function parseResearchOutput(raw: string, topic: string): ResearchOutput {
  const now = new Date().toISOString();

  // Extract platform-specific signals
  const redditSignal = extractSection(raw, 'Reddit') || extractSection(raw, 'r/');
  const xSignal = extractSection(raw, 'X') || extractSection(raw, 'Twitter');
  const youtubeSignal = extractSection(raw, 'YouTube');
  const polymarketSignal = extractSection(raw, 'Polymarket') || extractSection(raw, 'Prediction');

  // Extract or synthesize the summary
  let summary = extractSection(raw, 'Summary') || extractSection(raw, 'Synthesis') || extractSection(raw, 'Key Findings');
  if (!summary) {
    // Take the first substantial paragraph
    const paragraphs = raw.split('\n\n').filter(p => p.trim().length > 80 && !p.startsWith('#'));
    summary = paragraphs[0]?.trim() || raw.slice(0, 500);
  }

  return {
    topic,
    ran_at: now,
    reddit_signal: redditSignal || 'No Reddit signal found',
    x_signal: xSignal || 'No X signal found',
    youtube_signal: youtubeSignal || 'No YouTube signal found',
    polymarket_signal: polymarketSignal || 'No prediction market data found',
    public_sentiment_summary: summary.slice(0, 1000),
    best_takes: extractBestTakes(raw),
    sources_searched: extractSourcesSearched(raw),
    raw_output: raw,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const forBrief = args.includes('--for-brief');
  const topic = args.filter(a => !a.startsWith('--')).join(' ').trim();

  if (!topic) {
    console.error('Usage: npx ts-node scripts/last30days-research.ts "topic here"');
    process.exit(1);
  }

  console.log(`\n  Researching: "${topic}"`);
  console.log(`  Mode: ${forBrief ? 'daily brief enrichment' : 'story research'}\n`);

  // Run /last30days via the installed skill
  // The skill outputs markdown to stdout when invoked via claude CLI
  let rawOutput: string;
  try {
    // Try invoking via the skills CLI
    const skillPath = `${process.env.HOME}/.agents/skills/last30days`;
    const cmd = `cd "${skillPath}" && cat SKILL.md 2>/dev/null | head -5`;
    execSync(cmd, { encoding: 'utf-8' });

    // The skill is installed — invoke it via claude code in non-interactive mode
    // Fallback: run a web search aggregation ourselves
    console.log('  Skill installed. Running research...');

    // Use claude CLI to invoke the skill
    const claudeCmd = `echo "/last30days ${topic}" | claude --print 2>/dev/null || echo "SKILL_UNAVAILABLE"`;
    rawOutput = execSync(claudeCmd, {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 5,
    }).trim();

    if (rawOutput === 'SKILL_UNAVAILABLE' || rawOutput.length < 100) {
      console.log('  Claude CLI not available for skill invocation.');
      console.log('  Generating placeholder research structure...');
      rawOutput = generatePlaceholderResearch(topic);
    }
  } catch {
    console.log('  Falling back to placeholder research structure...');
    rawOutput = generatePlaceholderResearch(topic);
  }

  // Parse into structured output
  const research = parseResearchOutput(rawOutput, topic);

  // Remove raw_output for the cached file (too large)
  const cacheData = { ...research };
  delete cacheData.raw_output;

  // Write to cache
  const cacheDir = path.join(__dirname, 'research-cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const filename = `${slugify(topic)}-${date}.json`;
  const filepath = path.join(cacheDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(cacheData, null, 2));

  // Print summary
  console.log(`  Cached: ${filepath}\n`);
  console.log('  ── Research Summary ──────────────────────────────────');
  console.log(`  Topic: ${research.topic}`);
  console.log(`  Sources: ${research.sources_searched.join(', ') || 'none detected'}`);
  console.log(`  Reddit: ${research.reddit_signal.slice(0, 120)}`);
  console.log(`  X: ${research.x_signal.slice(0, 120)}`);
  if (research.polymarket_signal !== 'No prediction market data found') {
    console.log(`  Polymarket: ${research.polymarket_signal.slice(0, 120)}`);
  }
  console.log(`\n  Summary:\n  ${research.public_sentiment_summary.slice(0, 300)}`);
  if (research.best_takes.length > 0) {
    console.log(`\n  Best takes:`);
    research.best_takes.slice(0, 3).forEach((t, i) => console.log(`    ${i + 1}. "${t.slice(0, 100)}"`));
  }
  console.log('');
}

function generatePlaceholderResearch(topic: string): string {
  return `# Research: ${topic}

## Summary
Public sentiment research for "${topic}" requires the /last30days skill to be invoked interactively via Claude Code. Run this command in a Claude Code session:

\`/last30days ${topic}\`

Then paste the output into: scripts/research-cache/${slugify(topic)}-${new Date().toISOString().split('T')[0]}.json

## Reddit
No automated Reddit signal available — run /last30days interactively.

## X
No automated X signal available — run /last30days interactively.

## YouTube
No automated YouTube signal available.

## Polymarket
No prediction market data available.

## Sources Searched
Reddit, X, YouTube, Hacker News, Polymarket, Web
`;
}

main();
