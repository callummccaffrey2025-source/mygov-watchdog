import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PublishedPoll {
  id: string;
  pollster: string;
  poll_type: string;
  scope: string;
  field_start_date: string;
  field_end_date: string;
  publish_date: string;
  sample_size: number | null;
  methodology: string | null;
  primary_alp: number | null;
  primary_lnp: number | null;
  primary_grn: number | null;
  primary_one_nation: number | null;
  primary_ind: number | null;
  primary_other: number | null;
  tpp_alp: number | null;
  tpp_lnp: number | null;
  tpp_onp: number | null;
  source_url: string;
  verified_by_human: boolean;
  notes: string | null;
}

export interface PollAggregate {
  scope: string;
  as_of_date: string;
  window_days: number;
  tpp_alp: number | null;
  tpp_lnp: number | null;
  primary_alp: number | null;
  primary_lnp: number | null;
  primary_grn: number | null;
  primary_onp: number | null;
  poll_count: number;
}

export function usePublishedPolls(filters?: { pollster?: string; limit?: number }) {
  const [polls, setPolls] = useState<PublishedPoll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let query = supabase
          .from('published_polls')
          .select('*')
          .eq('scope', 'federal')
          .order('publish_date', { ascending: false })
          .limit(filters?.limit ?? 30);

        if (filters?.pollster) {
          query = query.eq('pollster', filters.pollster);
        }

        const { data } = await query;
        if (!cancelled) setPolls((data as PublishedPoll[]) || []);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [filters?.pollster, filters?.limit]);

  return { polls, loading };
}

export function usePollAggregate(windowDays: number = 30) {
  const [aggregate, setAggregate] = useState<PollAggregate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('poll_aggregates')
          .select('*')
          .eq('scope', 'federal')
          .eq('window_days', windowDays)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled) setAggregate(data as PollAggregate | null);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [windowDays]);

  return { aggregate, loading };
}

/** Get list of distinct pollsters for filter chips */
export function usePollsters() {
  const [pollsters, setPollsters] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('published_polls')
          .select('pollster')
          .eq('scope', 'federal')
          .order('publish_date', { ascending: false });

        if (!cancelled && data) {
          const unique = [...new Set(data.map((r: any) => r.pollster))];
          setPollsters(unique);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return pollsters;
}
