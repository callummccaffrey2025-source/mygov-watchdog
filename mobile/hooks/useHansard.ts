import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface HansardEntry {
  id: string;
  date: string;
  debate_topic: string | null;
  excerpt: string | null;
  source_url: string | null;
  chamber: string | null;
}

export function useHansard(memberId: string | undefined) {
  const [entries, setEntries] = useState<HansardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('hansard_entries')
          .select('id,date,debate_topic,excerpt,source_url,chamber')
          .eq('member_id', memberId)
          .order('date', { ascending: false })
          .limit(30);
        if (!cancelled) setEntries((data || []) as HansardEntry[]);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  return { entries, loading };
}
