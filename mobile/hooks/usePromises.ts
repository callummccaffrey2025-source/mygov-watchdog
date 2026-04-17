import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type PromiseStatus = 'not_started' | 'in_progress' | 'partially_kept' | 'kept' | 'broken';

export interface GovernmentPromise {
  id: string;
  title: string;
  description: string | null;
  source_quote: string | null;
  source_url: string | null;
  status: PromiseStatus;
  category: string | null;
  progress_notes: string | null;
  related_bill_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PromiseSummary {
  total: number;
  kept: number;
  broken: number;
  inProgress: number;
  partiallyKept: number;
  notStarted: number;
}

export function usePromises(statusFilter?: PromiseStatus, categoryFilter?: string) {
  const [promises, setPromises] = useState<GovernmentPromise[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('promises')
        .select('*')
        .order('updated_at', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);
      if (categoryFilter) query = query.eq('category', categoryFilter);

      const { data } = await query;
      setPromises((data as GovernmentPromise[]) || []);
    } catch {}
    setLoading(false);
  }, [statusFilter, categoryFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const summary: PromiseSummary = {
    total: promises.length,
    kept: promises.filter(p => p.status === 'kept').length,
    broken: promises.filter(p => p.status === 'broken').length,
    inProgress: promises.filter(p => p.status === 'in_progress').length,
    partiallyKept: promises.filter(p => p.status === 'partially_kept').length,
    notStarted: promises.filter(p => p.status === 'not_started').length,
  };

  return { promises, summary, loading, refresh };
}
