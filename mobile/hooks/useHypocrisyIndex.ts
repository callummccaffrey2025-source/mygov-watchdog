import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface HypocrisyTopic {
  policy_id: number;
  policy_name: string;
  stated_position: number;
  voting_position: number;
  disconnect_score: number;
  speech_count?: number;
  vote_count?: number;
  speech_excerpt: string | null;
  speech_date: string | null;
}

export interface HypocrisyData {
  status: 'scored' | 'insufficient_data';
  overall_score?: number;
  rank_among_mps?: number;
  total_mps_scored?: number;
  raw_score?: number;
  top_topics?: HypocrisyTopic[];
  speeches_classified?: number;
  votes_linked?: number;
}

export function useHypocrisyIndex(memberId: string | null) {
  const [data, setData] = useState<HypocrisyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: result, error } = await supabase.rpc('get_mp_hypocrisy', {
          p_mp_id: memberId,
        });
        if (!cancelled && result && !error) {
          setData(result as HypocrisyData);
        }
      } catch {
        // RPC may not exist on production yet — silent fail
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { data, loading };
}
