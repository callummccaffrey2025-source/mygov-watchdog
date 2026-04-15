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

    // Match against divisions.name which is always populated and contains the bill title as a
    // substring, e.g. "Bills — National Defence (AUKUS Implementation) Bill 2025 - Second Reading".
    // We avoid PostgREST .or() because parentheses in the term break its filter parser.
    // SQL ILIKE treats parentheses as literal characters, so this is safe.
    supabase
      .from('divisions')
      .select('id,name,date,chamber,aye_votes,no_votes,bill_title')
      .ilike('name', `%${term}%`)
      .order('date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) {
          setDivisions((data as RelatedDivision[]) || []);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [bill?.id]);

  return { divisions, loading };
}
