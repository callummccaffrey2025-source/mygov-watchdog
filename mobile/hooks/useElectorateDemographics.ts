import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface IndustryEntry {
  name: string;
  count: number;
  pct: number;
}

export interface ElectorateDemographics {
  id: string;
  electorate_id: string;
  census_year: number;
  median_age: number | null;
  median_household_income_weekly: number | null;
  median_personal_income_weekly: number | null;
  median_family_income_weekly: number | null;
  median_rent_weekly: number | null;
  median_mortgage_monthly: number | null;
  avg_household_size: number | null;
  pct_owned_outright: number | null;
  pct_owned_mortgage: number | null;
  pct_renting: number | null;
  top_industries: IndustryEntry[] | null;
}

export function useElectorateDemographics(electorateId: string | undefined) {
  const [demographics, setDemographics] = useState<ElectorateDemographics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electorateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('electorate_demographics')
          .select('*')
          .eq('electorate_id', electorateId)
          .order('census_year', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          setDemographics({
            ...data,
            top_industries: typeof data.top_industries === 'string'
              ? JSON.parse(data.top_industries)
              : data.top_industries,
          } as ElectorateDemographics);
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [electorateId]);

  return { demographics, loading };
}
