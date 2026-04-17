import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bill } from './useBills';

export interface RelatedDivision {
  id: string;
  name: string;
  date: string;
  chamber: string;
  aye_votes: number;
  no_votes: number;
  bill_title: string | null;
}

export function useBillDivisions(bill: Bill | null) {
  const [divisions, setDivisions] = useState<RelatedDivision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bill) return;
    // Use short_title if set, otherwise the full title — do NOT strip "Bill YYYY"
    // because the TVFY division name contains the full title as a substring.
    // Match against both `name` (always populated, e.g. "Bills — X Bill 2025 - Second Reading")
    // and `bill_title` (TVFY bills array title, may be null).
    const term = (bill.short_title ?? bill.title).trim();
    if (!term) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('divisions')
          .select('id,name,date,chamber,aye_votes,no_votes,bill_title')
          .ilike('name', `%${term}%`)
          .order('date', { ascending: false })
          .limit(20);
        if (!cancelled) setDivisions((data as RelatedDivision[]) || []);
      } catch {
        // Network failure — leave divisions empty
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [bill?.id]);

  return { divisions, loading };
}
