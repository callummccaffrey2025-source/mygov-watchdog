import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface RecentDivision {
  id: string;
  name: string;
  date: string;
  chamber: string;
  aye_votes: number;
  no_votes: number;
}

export function useRecentDivisions(limit = 5) {
  const [divisions, setDivisions] = useState<RecentDivision[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('divisions')
        .select('id,name,date,chamber,aye_votes,no_votes')
        .order('date', { ascending: false })
        .limit(limit);
      setDivisions((data as RecentDivision[]) || []);
    } catch {}
    setLoading(false);
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { divisions, loading, refresh };
}
