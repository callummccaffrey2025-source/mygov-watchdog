import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CLOSE_MARGIN = 10; // Divisions decided by 10 or fewer votes

export interface DecisiveVote {
  division_id: string;
  division_name: string;
  division_date: string;
  aye_votes: number;
  no_votes: number;
  margin: number;
  vote_cast: string; // 'aye' | 'no'
  on_winning_side: boolean;
}

export function useDecisiveVotes(memberId: string | undefined) {
  const [votes, setVotes] = useState<DecisiveVote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        // Get this member's division votes with division data
        const { data } = await supabase
          .from('division_votes')
          .select('vote_cast, division_id, divisions(id, name, date, aye_votes, no_votes)')
          .eq('member_id', memberId)
          .in('vote_cast', ['aye', 'no']);

        if (cancelled || !data) { setLoading(false); return; }

        const decisive: DecisiveVote[] = [];

        for (const row of data as any[]) {
          const d = row.divisions;
          if (!d || d.aye_votes == null || d.no_votes == null) continue;

          const margin = Math.abs(d.aye_votes - d.no_votes);
          if (margin > CLOSE_MARGIN) continue;

          const winner = d.aye_votes > d.no_votes ? 'aye' : d.aye_votes < d.no_votes ? 'no' : null;
          if (!winner) continue; // tied -- skip

          decisive.push({
            division_id: d.id,
            division_name: d.name || 'Division',
            division_date: d.date,
            aye_votes: d.aye_votes,
            no_votes: d.no_votes,
            margin,
            vote_cast: row.vote_cast,
            on_winning_side: row.vote_cast === winner,
          });
        }

        // Sort by margin ascending (closest first)
        decisive.sort((a, b) => a.margin - b.margin);

        if (!cancelled) setVotes(decisive);
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  const winningCount = votes.filter(v => v.on_winning_side).length;

  return { votes, winningCount, loading };
}
