/**
 * Ballot Decoded — structured election guide for a given electorate.
 * Returns candidates with party policies and voting record summaries.
 * Facts only — no recommendations, no endorsements.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Member } from './useMembers';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PolicyByTopic {
  category: string;
  summary_plain: string;
}

export interface VotingRecordByTopic {
  topic: string;
  total_votes: number;
  aye_count: number;
  aye_rate: number; // 0–100
}

export interface BallotCandidate {
  member: Member;
  party: { id: string; name: string; short_name: string | null; colour: string | null } | null;
  policy_summary_by_topic: PolicyByTopic[];
  voting_record_by_topic: VotingRecordByTopic[];
}

export interface BallotGuide {
  candidates: BallotCandidate[];
  electorate_name: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBallotGuide(electorateId: string | null) {
  const [guide, setGuide] = useState<BallotGuide>({ candidates: [], electorate_name: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGuide = useCallback(async () => {
    if (!electorateId) return;
    setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch electorate name ─────────────────────────────────────
      const { data: electorateRow } = await supabase
        .from('electorates')
        .select('name')
        .eq('id', electorateId)
        .limit(1)
        .single();

      const electorateName = electorateRow?.name ?? null;

      // ── 2. Fetch candidates (current members in this electorate) ─────
      const { data: members, error: membersErr } = await supabase
        .from('members')
        .select(
          '*, party:parties!members_party_id_fkey(id,name,short_name,colour,abbreviation), electorate:electorates(name,state)'
        )
        .eq('electorate_id', electorateId)
        .eq('is_active', true)
        .order('last_name');

      if (membersErr) {
        setError(membersErr.message);
        setLoading(false);
        return;
      }

      if (!members || members.length === 0) {
        setGuide({ candidates: [], electorate_name: electorateName });
        setLoading(false);
        return;
      }

      // ── 3. For each candidate, fetch party policies + voting record ──
      const candidates: BallotCandidate[] = await Promise.all(
        members.map(async (member: any) => {
          // Party policies
          let policies: PolicyByTopic[] = [];
          if (member.party_id) {
            const { data: policyRows } = await supabase
              .from('party_policies')
              .select('category,summary_plain')
              .eq('party_id', member.party_id);
            policies = (policyRows ?? []).map((p: any) => ({
              category: p.category,
              summary_plain: p.summary_plain,
            }));
          }

          // Voting record by topic — join division_votes with division_issue_tags
          let votingRecord: VotingRecordByTopic[] = [];
          try {
            const { data: votes } = await supabase
              .from('division_votes')
              .select('vote_cast, division:divisions(id)')
              .eq('member_id', member.id)
              .limit(500);

            if (votes && votes.length > 0) {
              // Get division IDs this member voted on
              const divisionIds = votes
                .map((v: any) => v.division?.id)
                .filter(Boolean);

              if (divisionIds.length > 0) {
                // Fetch issue tags for those divisions
                const { data: tags } = await supabase
                  .from('division_issue_tags')
                  .select('division_id,issue_slug,confidence')
                  .in('division_id', divisionIds)
                  .gte('confidence', 0.6);

                if (tags && tags.length > 0) {
                  // Build a map: division_id -> vote_cast
                  const voteMap = new Map<string, string>();
                  for (const v of votes as any[]) {
                    if (v.division?.id) {
                      voteMap.set(v.division.id, v.vote_cast);
                    }
                  }

                  // Aggregate by topic
                  const topicAgg: Record<string, { total: number; aye: number }> = {};
                  for (const tag of tags) {
                    const topic = tag.issue_slug;
                    const voteCast = voteMap.get(tag.division_id);
                    if (!voteCast) continue;
                    if (!topicAgg[topic]) topicAgg[topic] = { total: 0, aye: 0 };
                    topicAgg[topic].total += 1;
                    if (voteCast.toLowerCase() === 'aye') {
                      topicAgg[topic].aye += 1;
                    }
                  }

                  votingRecord = Object.entries(topicAgg)
                    .map(([topic, { total, aye }]) => ({
                      topic,
                      total_votes: total,
                      aye_count: aye,
                      aye_rate: total > 0 ? Math.round((aye / total) * 100) : 0,
                    }))
                    .sort((a, b) => b.total_votes - a.total_votes);
                }
              }
            }
          } catch {
            // Voting record fetch failed — leave empty, UI shows empty state
          }

          const partyData = member.party
            ? {
                id: member.party.id ?? member.party_id,
                name: member.party.name,
                short_name: member.party.short_name,
                colour: member.party.colour,
              }
            : null;

          return {
            member: member as Member,
            party: partyData,
            policy_summary_by_topic: policies,
            voting_record_by_topic: votingRecord,
          };
        })
      );

      setGuide({ candidates, electorate_name: electorateName });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load ballot guide');
    }

    setLoading(false);
  }, [electorateId]);

  useEffect(() => {
    fetchGuide();
  }, [fetchGuide]);

  return { ...guide, loading, error, refresh: fetchGuide };
}
