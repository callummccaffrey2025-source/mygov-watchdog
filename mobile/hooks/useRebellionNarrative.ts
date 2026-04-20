import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface RebellionRecord {
  id: string;
  divisionName: string;
  date: string;
  voteCast: string;
  ayeVotes: number;
  noVotes: number;
}

export interface RebellionNarrative {
  rebellions: RebellionRecord[];
  totalRebellions: number;
  rebellionRate: number; // 0-100 percentage
  totalVotes: number;
  biggestRebellion: { divisionName: string; date: string; voteCast: string } | null;
  mostRecentDate: string | null;
  loading: boolean;
}

export function useRebellionNarrative(memberId: string | null): RebellionNarrative {
  const [rebellions, setRebellions] = useState<RebellionRecord[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Fetch rebellion votes with division details
        const { data: rebelData, error: rebelError } = await supabase
          .from('division_votes')
          .select('id, vote_cast, division:divisions(id, name, date, aye_votes, no_votes)')
          .eq('member_id', memberId)
          .eq('rebelled', true)
          .order('created_at', { ascending: false });

        // Fetch total substantive vote count for rate calculation
        const { count, error: countError } = await supabase
          .from('division_votes')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId)
          .in('vote_cast', ['aye', 'no']);

        if (cancelled) return;

        if (!rebelError && rebelData) {
          const mapped: RebellionRecord[] = (rebelData as any[])
            .filter((r: any) => r.division)
            .map((r: any) => ({
              id: r.division.id,
              divisionName: r.division.name || 'Unknown division',
              date: r.division.date,
              voteCast: r.vote_cast,
              ayeVotes: r.division.aye_votes ?? 0,
              noVotes: r.division.no_votes ?? 0,
            }));
          setRebellions(mapped);
        }

        if (!countError && count != null) {
          setTotalVotes(count);
        }
      } catch {
        // Network failure — leave empty
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  const totalRebellions = rebellions.length;

  const rebellionRate = useMemo(() => {
    if (totalVotes === 0) return 0;
    return Math.round((totalRebellions / totalVotes) * 100);
  }, [totalRebellions, totalVotes]);

  const biggestRebellion = useMemo(() => {
    if (rebellions.length === 0) return null;
    const biggest = rebellions.reduce((max, r) => {
      const rTotal = r.ayeVotes + r.noVotes;
      const maxTotal = max.ayeVotes + max.noVotes;
      return rTotal > maxTotal ? r : max;
    });
    return {
      divisionName: biggest.divisionName,
      date: biggest.date,
      voteCast: biggest.voteCast,
    };
  }, [rebellions]);

  const mostRecentDate = useMemo(() => {
    if (rebellions.length === 0) return null;
    const sorted = [...rebellions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0].date;
  }, [rebellions]);

  return {
    rebellions,
    totalRebellions,
    rebellionRate,
    totalVotes,
    biggestRebellion,
    mostRecentDate,
    loading,
  };
}
