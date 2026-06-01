import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useCivicEvents } from './useCivicEvents';

/**
 * Verity Match — alignment between a user's issue stances and an MP / parties.
 *
 * Uses the server-side `get_match` RPC which correctly handles:
 * - aye_supports direction (Aye doesn't always mean "support")
 * - importance-weighted scoring
 * - limited-data guards (< 8 contributing votes → no precise %)
 * - party alignment ranking
 *
 * Also provides `useMatchVotes` for Show-your-working (contributing votes per issue).
 */

export interface PerIssueMatch {
  issue_slug: string;
  issue_name: string;
  user_stance: number;
  mp_lean: number | null;
  mp_sample: number;
  alignment_state: 'aligned' | 'gap' | 'big_gap' | 'insufficient_data';
  alignment_score: number | null;
}

export interface PartyMatch {
  party_id: string;
  party_name: string;
  short_name: string | null;
  abbreviation: string | null;
  match_pct: number | null;
  issues_scored: number;
}

export interface MatchData {
  overall_match_pct: number | null;
  limited_data: boolean;
  issues_scored: number;
  total_contributing_votes: number;
  per_issue: PerIssueMatch[];
  biggest_gap: {
    issue_slug: string;
    issue_name: string;
    user_stance: number;
    mp_lean: number;
    alignment_score: number;
    mp_sample: number;
  } | null;
  party_alignment: PartyMatch[];
}

export interface ContributingVote {
  division_id: string;
  division_name: string;
  division_date: string;
  vote_cast: string;
  aye_supports: boolean;
  vote_signal: 'support' | 'oppose' | 'neutral';
  confidence: number;
  rationale: string;
  source_url: string | null;
}

/** Fetch the full match breakdown for a single MP against the current user's stances. */
export function useMatchResult(memberId: string | null) {
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { log } = useCivicEvents();

  const compute = useCallback(async () => {
    if (!memberId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      const deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        setError('No device ID found');
        setLoading(false);
        return;
      }

      const { data: result, error: rpcErr } = await supabase.rpc('get_match', {
        p_device_id: deviceId,
        p_member_id: memberId,
      });

      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      if (result?.error) {
        setError(result.message ?? result.error);
        setLoading(false);
        return;
      }

      setData(result as MatchData);
      log('match_viewed', { member_id: memberId, overall_pct: result?.overall_match_pct });
    } catch (e: any) {
      setError(e.message ?? 'Failed to compute match');
    }
    setLoading(false);
  }, [memberId, log]);

  useEffect(() => { compute(); }, [compute]);

  return { data, loading, error, refresh: compute };
}

/** Fetch the contributing votes behind a specific issue for an MP (Show-your-working). */
export function useMatchVotes(memberId: string | null, issueSlug: string | null) {
  const [votes, setVotes] = useState<ContributingVote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!memberId || !issueSlug) return;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcErr } = await supabase.rpc('get_match_votes', {
        p_member_id: memberId,
        p_issue_slug: issueSlug,
      });

      if (rpcErr) { setError(rpcErr.message); }
      else { setVotes((result as ContributingVote[]) ?? []); }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load votes');
    }
    setLoading(false);
  }, [memberId, issueSlug]);

  useEffect(() => { fetch(); }, [fetch]);

  return { votes, loading, error };
}

/** Save or update a user's stance on an issue. */
export async function saveStance(
  issueId: string,
  stance: -1 | 0 | 1,
  importance: 1 | 2 | 3,
): Promise<{ error: string | null }> {
  const deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) return { error: 'No device ID' };

  const { error } = await supabase
    .from('user_issue_stances')
    .upsert(
      { device_id: deviceId, issue_id: issueId, stance, importance },
      { onConflict: 'device_id,issue_id' },
    );

  return { error: error?.message ?? null };
}

// ── Backward-compatible exports for MatchScreen ───────────────────────

export interface IssueMatch {
  issue_slug: string;
  issue_name: string;
  user_stance: number;
  mp_lean: number;
  aligned: boolean;
}

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
  match_score: number;
  issues_matched: number;
  insufficient_data: boolean;
  issue_breakdown: IssueMatch[];
}

/**
 * All-MPs ranking hook (used by MatchScreen leaderboard).
 * Calls get_match RPC for the user's own MP first, then computes lightweight
 * client-side scores for the full member list using aggregated vote data.
 */
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

      // 1. Get user stances (with issue slug via join)
      const { data: stanceData } = await supabase
        .from('user_issue_stances')
        .select('issue_id, stance, importance, policy_issues(slug, name)')
        .eq('device_id', deviceId)
        .neq('stance', 0);

      if (!stanceData || stanceData.length === 0) {
        setError('Complete the stance quiz first to see your matches');
        setLoading(false);
        return;
      }

      const userStances = stanceData.map((s: any) => ({
        issue_id: s.issue_id,
        slug: s.policy_issues?.slug ?? '',
        name: s.policy_issues?.name ?? '',
        stance: s.stance as number,
        importance: s.importance as number,
      }));

      // 2. Get all active members
      const { data: members } = await supabase
        .from('members')
        .select('id, first_name, last_name, photo_url, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates(name, state)')
        .eq('is_active', true);

      if (!members) { setError('Could not load members'); setLoading(false); return; }

      // 3. Get division_issue_tags with issue_id and aye_supports
      const { data: tags } = await supabase
        .from('division_issue_tags')
        .select('division_id, issue_id, aye_supports')
        .gte('confidence', 0.6);

      if (!tags || tags.length === 0) {
        setError('No tagged divisions available yet');
        setLoading(false);
        return;
      }

      // Build division → issue tags map
      const divTags = new Map<string, { issue_id: string; aye_supports: boolean }[]>();
      for (const t of tags) {
        const arr = divTags.get(t.division_id) ?? [];
        arr.push({ issue_id: t.issue_id, aye_supports: t.aye_supports });
        divTags.set(t.division_id, arr);
      }

      // 4. Get votes for tagged divisions (batch)
      const taggedIds = [...divTags.keys()];
      const allVotes: { member_id: string; division_id: string; vote_cast: string }[] = [];
      for (let i = 0; i < taggedIds.length; i += 500) {
        const batch = taggedIds.slice(i, i + 500);
        const { data: vb } = await supabase
          .from('division_votes')
          .select('member_id, division_id, vote_cast')
          .in('division_id', batch)
          .in('vote_cast', ['aye', 'no']);
        if (vb) allVotes.push(...vb);
      }

      // 5. Compute per-member, per-issue signal (using aye_supports)
      const memberSignals = new Map<string, Map<string, { support: number; oppose: number }>>();

      for (const vote of allVotes) {
        const issueTags = divTags.get(vote.division_id);
        if (!issueTags) continue;

        let mMap = memberSignals.get(vote.member_id);
        if (!mMap) { mMap = new Map(); memberSignals.set(vote.member_id, mMap); }

        for (const { issue_id, aye_supports } of issueTags) {
          let counts = mMap.get(issue_id);
          if (!counts) { counts = { support: 0, oppose: 0 }; mMap.set(issue_id, counts); }

          const isSupport =
            (vote.vote_cast === 'aye' && aye_supports) ||
            (vote.vote_cast === 'no' && !aye_supports);

          if (isSupport) counts.support++;
          else counts.oppose++;
        }
      }

      // 6. Score each member
      const results: MatchResult[] = [];
      const userIssueIds = new Set(userStances.map(s => s.issue_id));

      for (const member of members as any[]) {
        const mSignals = memberSignals.get(member.id);
        const breakdown: IssueMatch[] = [];
        let weightedSum = 0;
        let weightTotal = 0;

        for (const us of userStances) {
          const counts = mSignals?.get(us.issue_id);
          if (!counts || (counts.support + counts.oppose) < 3) continue;

          const total = counts.support + counts.oppose;
          const mpLean = (counts.support - counts.oppose) / total; // -1..+1
          const alignScore = (us.stance * mpLean + 1) / 2; // 0..1

          weightedSum += alignScore * us.importance;
          weightTotal += us.importance;

          breakdown.push({
            issue_slug: us.slug,
            issue_name: us.name,
            user_stance: us.stance,
            mp_lean: mpLean,
            aligned: alignScore >= 0.55,
          });
        }

        const insufficient = breakdown.length < 3;
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
          issue_breakdown: breakdown,
        });
      }

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
