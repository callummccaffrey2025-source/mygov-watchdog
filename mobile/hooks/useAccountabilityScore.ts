import { useMemo } from 'react';
import { DivisionVote } from './useVotes';

interface HansardEntry {
  id: string;
  date: string;
  debate_topic: string | null;
}

interface Committee {
  id: string;
  committee_name: string;
  role: string;
}

/**
 * Participation Index — four separate dimensions, never collapsed into a single number.
 *
 * Editorial principle (per Tingle/Silver review):
 * We measure parliamentary *participation*, not *accountability* or *virtue*.
 * Ministers give fewer speeches because they run departments. Safe-seat MPs
 * face different incentives than marginal-seat MPs. This index shows what
 * can be measured from public records and nothing more.
 *
 * Each dimension stays on its own scale. No weighted composite. Users see
 * all four and decide what matters to them.
 */

export interface ParticipationIndex {
  // Raw values (e.g., percentages, counts)
  attendanceRate: number;         // 0-100 %
  parliamentaryActivity: number;   // speeches + questions count
  speechesCount: number;
  questionsCount: number;
  independenceRate: number;        // 0-100 % of votes crossed floor
  committeeCount: number;
  chairCount: number;
  // Sample sizes for confidence indicators
  totalVotes: number;
  rebelVotes: number;
  // Flag for low-confidence (small sample)
  isLowSample: boolean;
}

// Roughly: an MP with fewer than 20 recorded votes has too thin a sample
const MIN_CONFIDENT_SAMPLE = 20;

export function useParticipationIndex(
  votes: DivisionVote[],
  speeches: HansardEntry[],
  committees: Committee[],
): ParticipationIndex {
  return useMemo(() => {
    // Paired absences (formal agreements with an opposition MP) are NOT accountability failures
    // and must be excluded from the attendance denominator entirely.
    const pairedVotes = votes.filter(v => v.vote_cast === 'paired' || v.vote_cast === 'pair').length;
    const countedVotes = votes.length - pairedVotes;
    const absentVotes = votes.filter(v => v.vote_cast === 'abstain' || v.vote_cast === 'absent').length;
    const presentVotes = countedVotes - absentVotes;
    const attendanceRate = countedVotes > 0 ? Math.round((presentVotes / countedVotes) * 100) : 0;

    const rebelVotes = votes.filter(v => v.rebelled).length;
    const substantiveVotes = votes.filter(v => v.vote_cast === 'aye' || v.vote_cast === 'no').length;
    const independenceRate = substantiveVotes > 0 ? Math.round((rebelVotes / substantiveVotes) * 100) : 0;

    const questionsCount = speeches.filter(s =>
      s.debate_topic?.toLowerCase().includes('question') ||
      s.debate_topic?.toLowerCase().includes('without notice')
    ).length;
    const speechesCount = speeches.length;

    const chairCount = committees.filter(c => c.role === 'chair' || c.role === 'deputy_chair').length;

    return {
      attendanceRate,
      parliamentaryActivity: speechesCount + questionsCount,
      speechesCount,
      questionsCount,
      independenceRate,
      committeeCount: committees.length,
      chairCount,
      totalVotes: countedVotes,
      rebelVotes,
      isLowSample: countedVotes < MIN_CONFIDENT_SAMPLE,
    };
  }, [votes, speeches, committees]);
}

// Kept for backwards compatibility — the old share card still uses the old shape.
// Returns a single number for share purposes only. UI must not display this.
export interface AccountabilityScore {
  overall: number;
  attendance: number;
  speech: number;
  voting: number;
  independence: number;
  question: number;
  committee: number;
}

export function useAccountabilityScore(
  votes: DivisionVote[],
  speeches: HansardEntry[],
  committees: Committee[],
  _partyName?: string | null,
): AccountabilityScore {
  const idx = useParticipationIndex(votes, speeches, committees);
  return {
    overall: idx.attendanceRate, // placeholder; UI should not render this
    attendance: idx.attendanceRate,
    speech: Math.min(100, Math.round((idx.speechesCount / 30) * 100)),
    voting: Math.min(100, Math.round((idx.totalVotes / 200) * 100)),
    independence: idx.independenceRate,
    question: Math.min(100, Math.round((idx.questionsCount / 10) * 100)),
    committee: Math.min(100, idx.committeeCount * 40 + idx.chairCount * 20),
  };
}
