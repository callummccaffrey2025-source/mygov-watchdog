import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MemberDivisionVote {
  id: string;
  vote_cast: string;
  rebelled: boolean;
  division: {
    id: string;
    name: string;
    date: string;
    chamber: string;
  };
}

export function useRecentMemberVotes(memberId: string | undefined, limit: number = 5) {
  const [votes, setVotes] = useState<MemberDivisionVote[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // Get total count
        const { count } = await supabase
          .from('division_votes')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId);
        if (!cancelled) setTotalCount(count ?? 0);

        // Get recent votes with division details
        const { data } = await supabase
          .from('division_votes')
          .select('id, vote_cast, rebelled, division:divisions(id, name, date, chamber)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!cancelled && data) {
          const parsed = (data as any[])
            .filter(v => v.division != null)
            .map(v => ({
              id: v.id,
              vote_cast: v.vote_cast,
              rebelled: v.rebelled,
              division: v.division,
            }));
          setVotes(parsed);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId, limit]);

  return { votes, totalCount, loading };
}
