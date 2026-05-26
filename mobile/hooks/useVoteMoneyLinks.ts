import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/** A single vote–donation link: MP voted on X, industry Y donated $Z */
export interface VoteMoneyLink {
  division_id: string;
  division_name: string;
  division_date: string;
  vote_cast: string;
  issue_slug: string;
  issue_name: string;
  aye_supports: boolean;
  donation_industry: string;
  industry_total_amount: number;
  industry_donor_count: number;
  top_donor_name: string | null;
  top_donor_amount: number;
}

/** Summary row: industry donated $X, MP cast Y related votes */
export interface VoteMoneySummary {
  donation_industry: string;
  total_amount: number;
  donor_count: number;
  related_vote_count: number;
  top_donor_name: string | null;
  sample_division_name: string | null;
}

export function useVoteMoneyLinks(memberId: string | undefined, limit = 20) {
  const [links, setLinks] = useState<VoteMoneyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef<Record<string, VoteMoneyLink[]>>({});

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    if (cache.current[memberId]) {
      setLinks(cache.current[memberId]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_vote_money_links', {
          p_member_id: memberId,
          p_limit: limit,
        });
        if (!cancelled && !error) {
          const rows = (data || []) as VoteMoneyLink[];
          cache.current[memberId] = rows;
          setLinks(rows);
        }
      } catch {
        // silent
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId, limit]);

  return { links, loading };
}

export function useVoteMoneySummary(memberId: string | undefined) {
  const [summary, setSummary] = useState<VoteMoneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef<Record<string, VoteMoneySummary[]>>({});

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    if (cache.current[memberId]) {
      setSummary(cache.current[memberId]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_vote_money_summary', {
          p_member_id: memberId,
        });
        if (!cancelled && !error) {
          const rows = (data || []) as VoteMoneySummary[];
          cache.current[memberId] = rows;
          setSummary(rows);
        }
      } catch {
        // silent
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { summary, loading };
}
