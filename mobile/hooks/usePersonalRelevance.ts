import { useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from './useElectorateByPostcode';

/**
 * Content relevance scoring engine.
 *
 * Scores any piece of content (bill, news story, vote, MP) by how relevant
 * it is to the current user, based on four dimensions:
 *   1. Geographic — content mentions user's electorate, state, or MP
 *   2. Interest — content matches user's tracked issues or selected topics
 *   3. Demographic — content affects user's housing/income/age bracket
 *   4. Behavioural — content matches topics the user has historically engaged with
 *
 * Returns a score 0-100 and a human-readable "why this matters" reason.
 */

export interface RelevanceResult {
  score: number;       // 0-100
  reason: string;      // "Affects renters in your electorate" | "Your MP voted on this"
  dimension: 'geographic' | 'interest' | 'demographic' | 'behavioural' | 'trending';
}

interface UserProfile {
  postcode: string | null;
  electorate: string | null;
  state: string | null;
  memberId: string | null;
  memberName: string | null;
  selectedTopics: string[];
  trackedIssues: string[];
  housingStatus: string | null;
  readTopics: Record<string, number>;
}

interface ContentSignals {
  // Geographic
  electorate?: string | null;
  state?: string | null;
  memberId?: string | null;
  memberName?: string | null;

  // Topic/issue
  topic?: string | null;
  categories?: string[];
  relevanceIssues?: string[];

  // Text for keyword matching
  title?: string;
  description?: string;

  // Engagement signals
  articleCount?: number;
  totalVotes?: number;
}

// Keywords that signal relevance to demographic groups
const DEMOGRAPHIC_KEYWORDS: Record<string, string[]> = {
  renter:   ['rent', 'rental', 'tenant', 'landlord', 'lease', 'renter', 'rental crisis', 'housing affordability'],
  owner:    ['mortgage', 'property', 'home owner', 'stamp duty', 'land tax', 'negative gearing', 'capital gains'],
  '18-24':  ['hecs', 'student', 'university', 'youth', 'apprentice', 'young people', 'first home'],
  '25-34':  ['first home', 'starter home', 'childcare', 'parental leave', 'hecs'],
  '35-44':  ['childcare', 'school', 'family', 'parental', 'mortgage'],
  '45-54':  ['superannuation', 'tax bracket', 'downsizing'],
  '55-64':  ['superannuation', 'retirement', 'pension', 'aged care', 'downsizing'],
  '65+':    ['pension', 'aged care', 'retirement', 'medicare', 'bulk billing', 'senior'],
  under_50k:  ['welfare', 'jobseeker', 'cost of living', 'bulk billing', 'concession'],
  '50k_100k': ['tax bracket', 'cost of living', 'childcare subsidy', 'hecs'],
  '100k_150k': ['tax bracket', 'stage 3', 'superannuation'],
  '150k_plus': ['tax bracket', 'stage 3', 'capital gains', 'negative gearing', 'superannuation'],
};

function textContainsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function usePersonalRelevance(profile: UserProfile) {
  const scoreContent = useCallback((signals: ContentSignals): RelevanceResult => {
    let bestScore = 0;
    let bestReason = '';
    let bestDimension: RelevanceResult['dimension'] = 'trending';

    const fullText = `${signals.title ?? ''} ${signals.description ?? ''}`.toLowerCase();

    // ── 1. Geographic (highest weight — most personal) ───────────────────

    // Direct MP match
    if (signals.memberId && profile.memberId && signals.memberId === profile.memberId) {
      const score = 95;
      if (score > bestScore) {
        bestScore = score;
        bestReason = profile.memberName
          ? `Your MP ${profile.memberName} is involved`
          : 'Involves your local MP';
        bestDimension = 'geographic';
      }
    }

    // Electorate match
    if (signals.electorate && profile.electorate && signals.electorate === profile.electorate) {
      const score = 90;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `Affects your electorate: ${profile.electorate}`;
        bestDimension = 'geographic';
      }
    }

    // State match (weaker than electorate)
    if (signals.state && profile.state && signals.state === profile.state) {
      const score = 50;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `Affects ${profile.state}`;
        bestDimension = 'geographic';
      }
    }

    // MP name mentioned in text
    if (profile.memberName && fullText.includes(profile.memberName.toLowerCase())) {
      const score = 85;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `Mentions your MP: ${profile.memberName}`;
        bestDimension = 'geographic';
      }
    }

    // ── 2. Interest (tracked issues match) ───────────────────────────────

    const matchedIssues = (signals.relevanceIssues ?? []).filter(
      i => profile.trackedIssues.includes(i)
    );
    if (matchedIssues.length > 0) {
      const score = 70 + matchedIssues.length * 5;
      if (score > bestScore) {
        bestScore = Math.min(score, 90);
        bestReason = `Matches your tracked issue: ${matchedIssues[0].replace(/_/g, ' ')}`;
        bestDimension = 'interest';
      }
    }

    // Topic match (broader, weaker signal)
    if (signals.topic && profile.selectedTopics.includes(signals.topic)) {
      const score = 60;
      if (score > bestScore) {
        bestScore = score;
        bestReason = `In your followed topic: ${signals.topic}`;
        bestDimension = 'interest';
      }
    }

    // Category overlap
    const catOverlap = (signals.categories ?? []).filter(c => profile.selectedTopics.includes(c));
    if (catOverlap.length > 0 && bestScore < 55) {
      bestScore = 55;
      bestReason = `Related to your interest: ${catOverlap[0]}`;
      bestDimension = 'interest';
    }

    // ── 3. Demographic (housing, income, age) ────────────────────────────

    if (profile.housingStatus) {
      const keywords = DEMOGRAPHIC_KEYWORDS[profile.housingStatus];
      if (keywords && textContainsAny(fullText, keywords)) {
        const score = 75;
        if (score > bestScore) {
          bestScore = score;
          const label = profile.housingStatus === 'renter' ? 'renters' :
                        profile.housingStatus === 'owner' ? 'homeowners' : 'your situation';
          bestReason = `Affects ${label} like you`;
          bestDimension = 'demographic';
        }
      }
    }

    // Age bracket keywords
    const ageBracket = profile.readTopics?.['_age_bracket'] as unknown as string;
    // (age_bracket would come from profile but we check readTopics as proxy)

    // ── 4. Behavioural (read history) ────────────────────────────────────

    if (signals.topic && profile.readTopics[signals.topic] && profile.readTopics[signals.topic] >= 3) {
      const readCount = profile.readTopics[signals.topic];
      const score = Math.min(45, 30 + readCount);
      if (score > bestScore) {
        bestScore = score;
        bestReason = `You frequently read about ${signals.topic}`;
        bestDimension = 'behavioural';
      }
    }

    // ── 5. Trending fallback ─────────────────────────────────────────────

    if (bestScore === 0 && (signals.articleCount ?? 0) >= 5) {
      bestScore = 20;
      bestReason = 'Trending nationally';
      bestDimension = 'trending';
    }

    return {
      score: Math.min(100, bestScore),
      reason: bestReason || 'National news',
      dimension: bestDimension,
    };
  }, [profile]);

  return { scoreContent };
}

/**
 * Hook that loads the user's profile for relevance scoring.
 * Combines data from UserContext, AsyncStorage, and Supabase.
 */
export function useUserProfile(): UserProfile {
  const { user, postcode } = useUser();
  const { member, electorate } = useElectorateByPostcode(postcode);

  // TODO: Load trackedIssues, housingStatus, readTopics from user_preferences
  // For now, use selectedTopics from AsyncStorage (set during onboarding)
  // This will be enhanced when the onboarding migration is deployed

  return useMemo(() => ({
    postcode,
    electorate: electorate?.name ?? null,
    state: electorate?.state ?? null,
    memberId: member?.id ?? null,
    memberName: member ? `${member.first_name} ${member.last_name}` : null,
    selectedTopics: [], // loaded async — populated by caller
    trackedIssues: [],  // loaded async — populated by caller
    housingStatus: null,
    readTopics: {},
  }), [postcode, electorate, member]);
}

/**
 * Generate a "why this matters to you" line for any content.
 * Falls back to a generic line if no personal relevance found.
 */
export function getRelevanceLine(result: RelevanceResult): string | null {
  if (result.score < 20) return null;
  return result.reason;
}
