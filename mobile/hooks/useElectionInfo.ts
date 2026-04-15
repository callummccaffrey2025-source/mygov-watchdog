import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ElectionInfo {
  id: string;
  election_type: string;
  state: string | null;
  election_date: string | null;
  is_called: boolean;
  candidates: any | null;
  created_at: string;
}

// Federal election must be held by May 2028 (after May 2025 election)
export const NEXT_ELECTION_DEADLINE = new Date('2028-05-17');

export function useElectionInfo(electionType: 'federal' | 'state' = 'federal') {
  const [election, setElection] = useState<ElectionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('election_info')
      .select('*')
      .eq('election_type', electionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setElection(data ?? null);
        setLoading(false);
      });
  }, [electionType]);

  return { election, loading };
}
