import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useCivicEvents } from './useCivicEvents';

/**
 * Verity Match — scores all MPs against user's issue stances.
 *
 * Algorithm:
 * 1. Fetch user stances (issue_slug → stance -2..+2, importance 1-3)
 * 2. For each MP, fetch their vote lean per issue (from division_votes +
 *    division_issue_tags with confidence >= 0.6)
 * 3. Score = weighted cosine similarity: Σ(user_stance × mp_lean × importance) / normalizer
 * 4. Return sorted by match_score descending
 *
 * Integrity: MPs with < 3 scored issues show "insufficient data" instead of a score.
 */

export interface MatchResult {
  member_id: string;
  first_name: string;
  last_name: string;
  party_name: string;
  party_short: string | null;
  party_colour: string | null;
  electorate_name: string;
  state: string;
  photo_url: string | null;
  match_score: number;          // 0–100
  issues_matched: number;
  insufficient_data: boolean;
  issue_breakdown: IssueMatch[];
}

export interface IssueMatch {
  issue_slug: string;
  issue_name: string;
  user_stance: number;
  mp_lean: number;
  aligned: boolean;
}

const MIN_ISSUES_FOR_SCORE = 3;

export function useVerityMatch() {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { log } = useCivicEvents();

  const compute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) { setLoading(false); return; }

      // 1. Get user stances
      const { data: stanceData } = await supabase
        .from('user_issue_stances')
        .select('issue_slug, stance, importance')
        .eq('device_id', deviceId);

      if (!stanceData || stanceData.length === 0) {
        setError('Complete the stance quiz first to see your matches');
        setLoading(false);
        return;
      }

      const userStances = new Map(
        stanceData.map(s => [s.issue_slug, { stance: s.stance, importance: s.importance }]),
      );

      // 2. Get issue names
      const { data: issueNames } = await supabase
        .from('policy_issues')
        .select('slug, name');
      const nameMap = new Map((issueNames ?? []).map(i => [i.slug, i.name]));

      // 3. Get all members
      const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, photo_url, party:parties(name, short_name, colour), electorate:electorates(name, state)')
        .eq('is_current', true);

      if (!members) { setError('Could not load members'); setLoading(false); return; }

      // 4. Get MP vote leans per issue (aggregated)
      // division_issue_tags links division_id → issue_slug with confidence
      // division_votes links division_id → member_id with vote_cast
      const { data: taggedVotes } = await supabase
        .from('division_issue_tags')
        .select('division_id, issue_slug, confidence')
        .gte('confidence', 0.6);

      if (!taggedVotes) { setError('Could not load vote data'); setLoading(false); return; }

      // Build division → issues map
      const divisionIssues = new Map<string, { issue_slug: string; confidence: number }[]>();
      for (const tv of taggedVotes) {
        const arr = divisionIssues.get(tv.division_id) ?? [];
        arr.push({ issue_slug: tv.issue_slug, confidence: tv.confidence });
        divisionIssues.set(tv.division_id, arr);
      }

      // Get votes for tagged divisions
      const taggedDivisionIds = [...divisionIssues.keys()];
      if (taggedDivisionIds.length === 0) {
        setError('No tagged divisions available yet');
        setLoading(false);
        return;
      }

      // Batch in groups of 500 to avoid URL length limits
      const allVotes: { member_id: string; division_id: string; vote_cast: string }[] = [];
      for (let i = 0; i < taggedDivisionIds.length; i += 500) {
        const batch = taggedDivisionIds.slice(i, i + 500);
        const { data: votesBatch } = await supabase
          .from('division_votes')
          .select('member_id, division_id, vote_cast')
          .in('division_id', batch)
          .in('vote_cast', ['aye', 'no']);
        if (votesBatch) allVotes.push(...votesBatch);
      }

      // 5. Compute per-member, per-issue lean
      // lean = (aye_count - no_count) / total_count → normalised to -1..+1
      const memberIssueLean = new Map<string, Map<string, { aye: number; no: number }>>();

      for (const vote of allVotes) {
        const issues = divisionIssues.get(vote.division_id);
        if (!issues) continue;

        let memberMap = memberIssueLean.get(vote.member_id);
        if (!memberMap) {
          memberMap = new Map();
          memberIssueLean.set(vote.member_id, memberMap);
        }

        for (const { issue_slug } of issues) {
          let counts = memberMap.get(issue_slug);
          if (!counts) {
            counts = { aye: 0, no: 0 };
            memberMap.set(issue_slug, counts);
          }
          if (vote.vote_cast === 'aye') counts.aye++;
          else counts.no++;
        }
      }

      // 6. Score each member
      const results: MatchResult[] = [];

      for (const member of members as any[]) {
        const memberIssues = memberIssueLean.get(member.id);
        const breakdown: IssueMatch[] = [];
        let weightedSum = 0;
        let weightTotal = 0;

        for (const [issueSlug, userPos] of userStances) {
          const counts = memberIssues?.get(issueSlug);
          if (!counts || (counts.aye + counts.no) === 0) continue;

          const mpLean = (counts.aye - counts.no) / (counts.aye + counts.no); // -1 to +1
          const userNorm = userPos.stance / 2; // -1 to +1
          const similarity = 1 - Math.abs(userNorm - mpLean) / 2; // 0 to 1
          const weight = userPos.importance;

          weightedSum += similarity * weight;
          weightTotal += weight;

          breakdown.push({
            issue_slug: issueSlug,
            issue_name: nameMap.get(issueSlug) ?? issueSlug,
            user_stance: userPos.stance,
            mp_lean: mpLean,
            aligned: Math.sign(userNorm) === Math.sign(mpLean) || Math.abs(userNorm - mpLean) < 0.5,
          });
        }

        const insufficient = breakdown.length < MIN_ISSUES_FOR_SCORE;
        const score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0;

        const party = Array.isArray(member.party) ? member.party[0] : member.party;
        const electorate = Array.isArray(member.electorate) ? member.electorate[0] : member.electorate;

        results.push({
          member_id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          party_name: party?.name ?? 'Unknown',
          party_short: party?.short_name ?? null,
          party_colour: party?.colour ?? null,
          electorate_name: electorate?.name ?? '',
          state: electorate?.state ?? '',
          photo_url: member.photo_url,
          match_score: score,
          issues_matched: breakdown.length,
          insufficient_data: insufficient,
          issue_breakdown: breakdown.sort((a, b) =>
            Math.abs(b.user_stance) - Math.abs(a.user_stance),
          ),
        });
      }

      // Sort: sufficient-data members by score desc, then insufficient at the end
      results.sort((a, b) => {
        if (a.insufficient_data !== b.insufficient_data) return a.insufficient_data ? 1 : -1;
        return b.match_score - a.match_score;
      });

      setMatches(results);
      log('match_viewed', { total_matches: results.length });
    } catch (e: any) {
      setError(e.message ?? 'Failed to compute matches');
    }

    setLoading(false);
  }, [log]);

  useEffect(() => { compute(); }, [compute]);

  return { matches, loading, error, refresh: compute };
}
