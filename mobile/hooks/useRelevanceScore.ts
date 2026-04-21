import { NewsStory } from './useNewsStories';

export interface RelevanceContext {
  electorate: string | null;
  mpName: string | null;
  followedTopics: string[];
  followedIssueCategories: string[];
  housingStatus: string | null;
  state: string | null;
  viewedStoryIds: Set<number>;
  dismissedStoryIds: Set<number>;
}

interface ScoreResult {
  score: number;
  reason: string | null;
}

const HOUSING_KEYWORDS = [
  'housing', 'rent', 'rental', 'tenant', 'mortgage', 'property',
  'stamp duty', 'negative gearing', 'home owner', 'landlord',
  'housing affordability', 'rental crisis', 'first home',
];

/**
 * Score a single news story against the user's relevance context.
 *
 * Scoring factors:
 *  - Issue category match:         +30
 *  - MP name in headline:          +25
 *  - Electorate in headline:       +20
 *  - State in headline:            +10
 *  - Housing relevance:            +15
 *  - Source count (coverage):      +floor(article_count / 5)
 *  - Freshness decay:              -1 per day old
 *  - Blindspot boost:              +5
 *  - Already viewed:               -40
 *  - Dismissed:                    -80
 */
export function scoreStory(story: NewsStory, ctx: RelevanceContext): ScoreResult {
  let score = 0;
  let reason: string | null = null;
  const headline = story.headline.toLowerCase();

  // ── Issue category match (+30) ──────────────────────────────────────
  if (
    story.category &&
    ctx.followedIssueCategories.length > 0 &&
    ctx.followedIssueCategories.some(
      cat => cat.toLowerCase() === story.category!.toLowerCase()
    )
  ) {
    score += 30;
    reason = `Your issue: ${story.category.replace(/_/g, ' ')}`;
  }

  // ── MP name in headline (+25) ───────────────────────────────────────
  if (ctx.mpName && headline.includes(ctx.mpName.toLowerCase())) {
    score += 25;
    if (!reason) reason = 'Your MP';
  }

  // ── Electorate in headline (+20) ────────────────────────────────────
  if (ctx.electorate && headline.includes(ctx.electorate.toLowerCase())) {
    score += 20;
    if (!reason) reason = 'Your electorate';
  }

  // ── State in headline (+10) ─────────────────────────────────────────
  if (ctx.state && headline.includes(ctx.state.toLowerCase())) {
    score += 10;
    if (!reason) reason = `Affects ${ctx.state}`;
  }

  // ── Housing relevance (+15) ─────────────────────────────────────────
  if (
    ctx.housingStatus &&
    (ctx.housingStatus === 'renter' || ctx.housingStatus === 'owner') &&
    HOUSING_KEYWORDS.some(kw => headline.includes(kw))
  ) {
    score += 15;
    if (!reason) {
      reason = ctx.housingStatus === 'renter'
        ? 'Your issue: housing (renter)'
        : 'Your issue: housing (homeowner)';
    }
  }

  // ── Topic match (followed topics from onboarding) ───────────────────
  if (
    story.category &&
    ctx.followedTopics.length > 0 &&
    ctx.followedTopics.some(
      t => t.toLowerCase() === story.category!.toLowerCase()
    )
  ) {
    // Only add if not already counted via issue categories
    if (
      !ctx.followedIssueCategories.some(
        cat => cat.toLowerCase() === story.category!.toLowerCase()
      )
    ) {
      score += 15;
      if (!reason) reason = `Follows: ${story.category.replace(/_/g, ' ')}`;
    }
  }

  // ── Source count / coverage breadth ─────────────────────────────────
  score += Math.floor(story.article_count / 5);

  // ── Freshness decay (-1 per day old) ────────────────────────────────
  const ageMs = Date.now() - new Date(story.first_seen).getTime();
  const ageDays = ageMs / 86_400_000;
  score -= Math.floor(ageDays);

  // ── Blindspot boost (+5) ────────────────────────────────────────────
  if (story.blindspot) {
    score += 5;
  }

  // ── Already viewed (-40) ────────────────────────────────────────────
  if (ctx.viewedStoryIds.has(story.id)) {
    score -= 40;
  }

  // ── Dismissed (-80) ─────────────────────────────────────────────────
  if (ctx.dismissedStoryIds.has(story.id)) {
    score -= 80;
  }

  return { score, reason };
}
