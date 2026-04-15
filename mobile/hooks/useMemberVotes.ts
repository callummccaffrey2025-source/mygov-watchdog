import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface MemberVote {
  id: string;
  member_id: string;
  bill_id: string;
  vote: 'aye' | 'no' | 'absent' | 'abstain';
  created_at: string;
  bill?: { id: string; title: string; current_status: string | null };
}

export function useMemberVotes(memberId: string | null) {
  const [votes, setVotes] = useState<MemberVote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('member_votes')
      .select('*, bill:bills(id,title,current_status)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (!cancelled) {
          if (err) setError(err.message);
          else setVotes(data || []);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [memberId]);

  return { votes, loading, error };
}
