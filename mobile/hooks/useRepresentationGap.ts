import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AlignmentRecord {
  poll_id: string;
  division_id: string;
  division_name: string;
  division_date: string;
  question: string;
  vote_cast: string;
  alignment: 'aligned' | 'misaligned' | 'absent' | 'insufficient_data';
  data_level: 'electorate' | 'national' | 'none';
  majority_pct: number | null;
  majority_direction: string | null;
  sample_size: number;
}

export function useRepresentationGap(memberId: string | undefined) {
  const [records, setRecords] = useState<AlignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('representation_alignment')
          .select('poll_id, division_id, division_name, division_date, question, vote_cast, alignment, data_level, majority_pct, majority_direction, sample_size')
          .eq('member_id', memberId)
          .neq('alignment', 'insufficient_data')
          .order('division_date', { ascending: false });

        if (!cancelled) {
          setRecords((data as AlignmentRecord[]) || []);
        }
      } catch {
        // View returns empty when no poll_division_links exist
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { records, loading };
}
