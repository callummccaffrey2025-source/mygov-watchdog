import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ParticipationData {
  votingValue: number;
  votingPercentile: number;
  votesCast: number;
  divisionsEligible: number;
  activityValue: number;
  activityPercentile: number;
  speechesTotal: number;
  questionsAsked: number;
  independenceValue: number;
  independencePercentile: number;
  votesAgainstParty: number;
  committeeValue: number;
  committeePercentile: number;
  activeCommittees: number;
  periodStart: string | null;
  periodEnd: string | null;
}

export function useParticipationData(memberId: string | undefined) {
  const [data, setData] = useState<ParticipationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data: row } = await supabase
          .from('participation_index')
          .select('*')
          .eq('member_id', memberId)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && row) {
          setData({
            votingValue: Number(row.voting_participation_value) || 0,
            votingPercentile: Number(row.voting_participation_percentile) || 0,
            votesCast: row.votes_cast || 0,
            divisionsEligible: row.divisions_eligible || 0,
            activityValue: Number(row.parliamentary_activity_value) || 0,
            activityPercentile: Number(row.parliamentary_activity_percentile) || 0,
            speechesTotal: row.speeches_total || 0,
            questionsAsked: row.questions_asked || 0,
            independenceValue: Number(row.independence_value) || 0,
            independencePercentile: Number(row.independence_percentile) || 0,
            votesAgainstParty: row.votes_against_party || 0,
            committeeValue: Number(row.committee_value) || 0,
            committeePercentile: Number(row.committee_percentile) || 0,
            activeCommittees: row.active_committees || 0,
            periodStart: row.period_start,
            periodEnd: row.period_end,
          });
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  return { participation: data, loading };
}
