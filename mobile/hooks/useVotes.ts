import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DivisionVote {
  id: string;
  vote_cast: string;
  rebelled: boolean;
  member_id: string;
  created_at: string;
  division: {
    id: string;
    name: string;
    date: string;
    chamber: string;
    aye_votes: number;
    no_votes: number;
  } | null;
}

export function useVotes(memberId: string | null) {
  const [votes, setVotes] = useState<DivisionVote[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('division_votes')
          .select('id, vote_cast, rebelled, member_id, created_at, division:divisions(id, name, date, chamber, aye_votes, no_votes)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(100);
        if (cancelled) return;
        if (!error) setVotes((data as unknown as DivisionVote[]) || []);
      } catch {
        // Network/Supabase failure — leave votes empty so UI shows empty state
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { votes, loading };
}
