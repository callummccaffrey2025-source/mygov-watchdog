import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BillVote {
  id: string;
  member_id: string;
  vote: 'aye' | 'no' | 'absent' | 'abstain';
  member?: {
    first_name: string;
    last_name: string;
    party?: { short_name: string; colour: string };
  };
}

export function useBillVotes(billId: string | null) {
  const [votes, setVotes] = useState<BillVote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!billId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('member_votes')
      .select('*, member:members(first_name,last_name,party:parties(short_name,colour))')
      .eq('bill_id', billId)
      .then(({ data, error: err }) => {
        if (!cancelled) {
          if (err) setError(err.message);
          else setVotes(data || []);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [billId]);

  return { votes, loading, error };
}
