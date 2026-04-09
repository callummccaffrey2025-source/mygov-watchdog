import { useMemo } from 'react';
import { NewsStory } from './useNewsStories';

interface FeedOptions {
  electorate: string | null;
  mpName: string | null;
  followedTopics: string[];
}

// Civic / political keywords used to filter out crime, sport, lifestyle, etc.
// A story passes if its headline contains at least ONE of these (case-insensitive)
// OR its `category` is set to a known civic topic.
const POLITICAL_KEYWORDS = [
  'parliament', 'bill', 'legislation', 'minister', 'mp ', ' mp', 'senator', 'senate',
  'vote', 'election', 'policy', 'government', 'opposition', 'budget', 'tax', 'taxes',
  'housing', 'climate', 'defence', 'immigration', 'healthcare', 'health', 'education',
  'economy', 'rba', 'reserve bank', 'interest rate', 'inflation',
  'albanese', 'dutton', 'labor', 'liberal', 'greens', 'nationals', 'coalition',
  'pm ', 'prime minister', 'treasurer', 'attorney-general',
  'aukus', 'rba', 'chalmers', 'wong', 'marles', 'plibersek', 'bowen',
  'electorate', 'cabinet', 'caucus', 'crossbench', 'aec', 'referendum',
  'royal commission', 'hansard', 'high court',
];

const CIVIC_CATEGORIES = new Set([
  'politics', 'economy', 'climate', 'health', 'defence', 'housing', 'education',
  'immigration', 'indigenous_affairs', 'technology', 'agriculture', 'cost_of_living',
  'infrastructure', 'foreign_policy', 'justice', 'legislation', 'election',
]);

/**
 * Returns true if a story is civic / political content worth showing in the feed.
 * Excludes crime blotter, sport, lifestyle, celebrity, etc.
 */
export function isPoliticalStory(story: NewsStory): boolean {
  const cat = (story.category || '').toLowerCase().trim();
  if (cat && CIVIC_CATEGORIES.has(cat)) return true;

  const headline = (story.headline || '').toLowerCase();
  return POLITICAL_KEYWORDS.some(kw => headline.includes(kw));
}

/**
 * Filter stories down to political/civic content only.
 * Used by HomeScreen + DailyBriefScreen to keep the feed on-mission.
 */
export function filterPoliticalStories(stories: NewsStory[]): NewsStory[] {
  return stories.filter(isPoliticalStory);
}

/**
 * Ranks news stories by personalisation signals.
 * Pure function — no hooks or data fetching; caller provides stories + context.
 */
export function rankStories(
  stories: NewsStory[],
  options: FeedOptions,
): NewsStory[] {
  const { electorate, mpName, followedTopics } = options;
  const topicSet = new Set(followedTopics.map(t => t.toLowerCase()));

  // Apply civic filter FIRST so non-political content can never reach the feed
  return filterPoliticalStories(stories)
    .map(story => {
      let score = 0;

      // Electorate / MP relevance
      if (electorate && story.headline.toLowerCase().includes(electorate.toLowerCase())) {
        score += 5;
      }
      if (mpName && story.headline.toLowerCase().includes(mpName.toLowerCase())) {
        score += 5;
      }

      // Topic match
      if (story.category && topicSet.has(story.category.toLowerCase())) {
        score += 3;
      }

      // Blindspot boost
      if (story.blindspot) {
        score += 2;
      }

      // Source count
      score += Math.floor(story.article_count / 10);

      // Recency (decay: lose 1 point per day old)
      const ageMs = Date.now() - new Date(story.first_seen).getTime();
      const ageDays = ageMs / 86_400_000;
      score -= Math.floor(ageDays);

      return { story, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ story }) => story);
}

/**
 * Hook that returns personalised story ranking.
 * Wraps rankStories in useMemo for performance.
 */
export function usePersonalisedFeed(
  stories: NewsStory[],
  options: FeedOptions,
): NewsStory[] {
  return useMemo(
    () => rankStories(stories, options),
    [stories, options.electorate, options.mpName, options.followedTopics.join(',')],
  );
}
