/**
 * Representation Index — per-MP alignment with their electorate's stance.
 * Prompt 9: calls the compute_representation_index RPC.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface RepIndexEntry {
  member_id: string;
  member_name: string;
  party: string;
  electorate: string;
  electorate_id: string;
  photo_url: string | null;
  alignment_score: number;
  issues_covered: number;
  sample_size: number;
  rank: number;
  total_ranked: number;
  contributing_issues: ContributingIssue[];
}

export interface ContributingIssue {
  issue_slug: string;
  issue_name: string;
  electorate_stance: number;
  mp_lean: number;
  aligned: boolean;
  respondents: number;
}

// Configurable thresholds — the integrity guards
const MIN_SAMPLE = 10;
const MIN_ISSUES = 3;

export function useRepresentationIndex() {
  const [index, setIndex] = useState<RepIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('compute_representation_index', {
      p_min_sample: MIN_SAMPLE,
      p_min_issues: MIN_ISSUES,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIndex([]);
    } else {
      setIndex((data as RepIndexEntry[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { index, loading, error, refresh: fetch, minSample: MIN_SAMPLE, minIssues: MIN_ISSUES };
}

/**
 * Single MP's representation score — for badge display on profile.
 */
export function useMPRepresentationScore(memberId: string | null) {
  const [score, setScore] = useState<RepIndexEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase.rpc('compute_representation_index', {
        p_min_sample: MIN_SAMPLE,
        p_min_issues: MIN_ISSUES,
      });

      if (!cancelled && data) {
        const entry = (data as RepIndexEntry[]).find(e => e.member_id === memberId);
        setScore(entry ?? null);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { score, loading };
}
