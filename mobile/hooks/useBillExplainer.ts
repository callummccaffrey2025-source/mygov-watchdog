import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BillExplainer {
  summary_3line: string;
  what_it_changes_for_you: string | null;
  caveats: string | null;
  cached: boolean;
}

/**
 * On-demand plain-English bill explainer.
 * First checks the local cache (bills_plain_english table), then calls the
 * explain-bill Edge Function which generates + caches via Anthropic.
 */
export function useBillExplainer(billId: string | null) {
  const [explainer, setExplainer] = useState<BillExplainer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!billId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Try local cache first (instant, no Edge Function call)
        const { data: cached } = await supabase
          .from('bills_plain_english')
          .select('summary_3line, what_it_changes_for_you, caveats')
          .eq('bill_id', billId)
          .maybeSingle();

        if (cached && !cancelled) {
          setExplainer({ ...cached, cached: true });
          setLoading(false);
          return;
        }

        // Generate on demand via Edge Function
        const { data, error: fnErr } = await supabase.functions.invoke('explain-bill', {
          body: { bill_id: billId },
        });

        if (cancelled) return;

        if (fnErr) {
          setError('Could not generate explainer');
        } else if (data?.error) {
          setError(data.error);
        } else if (data?.summary_3line) {
          setExplainer(data as BillExplainer);
        }
      } catch {
        if (!cancelled) setError('Failed to load explainer');
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [billId]);

  return { explainer, loading, error };
}
