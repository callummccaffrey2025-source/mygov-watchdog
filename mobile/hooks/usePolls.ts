import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
  bill_id: string | null;
  closes_at: string | null;
  _voteCounts?: number[];
  _totalVotes?: number;
}

export function usePolls() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: pollData, error: err } = await supabase
          .from('polls')
          .select('*')
          .eq('is_active', true)
          .order('closes_at', { ascending: true });

        if (err) { setError(err.message); setLoading(false); return; }

        const enriched = await Promise.all((pollData || []).map(async (poll) => {
          const { data: voteData } = await supabase
            .from('poll_votes')
            .select('option_index')
            .eq('poll_id', poll.id);

          const counts = (poll.options || []).map((_: any, i: number) =>
            (voteData || []).filter(v => v.option_index === i).length
          );
          return { ...poll, _voteCounts: counts, _totalVotes: counts.reduce((a: number, b: number) => a + b, 0) };
        }));

        setPolls(enriched);
      } catch (e: any) {
        setError(e?.message || 'Failed to load polls');
      }
      setLoading(false);
    };

    fetch();
  }, []);

  return { polls, loading, error };
}
