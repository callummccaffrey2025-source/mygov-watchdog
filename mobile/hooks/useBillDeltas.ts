import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BillDelta {
  id: string;
  bill_id: string;
  status_changed: boolean;
  title_changed: boolean;
  summary_changed: boolean;
  change_summary: string;
  changed_sections: Array<{
    type: 'added' | 'removed' | 'modified';
    before?: string;
    after?: string;
    text?: string;
    section: string;
  }>;
  beneficiary: string | null;
  loophole_flags: Array<{
    flag_type: string;
    severity: string;
    sector: string;
    confidence: number;
    source_span: { before: string; after: string; section: string };
    between_readings: boolean;
  }>;
  progress_stages_added: Array<{ stage: string; chamber: string; date: string }>;
  source_spans: Array<{ section: string; type: string; from_text?: string; to_text?: string }>;
  created_at: string;
  from_version: { version_number: number; reading_stage: string; status_snapshot: string } | null;
  to_version: { version_number: number; reading_stage: string; status_snapshot: string } | null;
}

export function useBillDeltas(billId: string | undefined) {
  const [deltas, setDeltas] = useState<BillDelta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!billId) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('bill_deltas')
          .select(`
            id, bill_id, status_changed, title_changed, summary_changed,
            change_summary, changed_sections, beneficiary, loophole_flags,
            progress_stages_added, source_spans, created_at,
            from_version:from_version_id(version_number, reading_stage, status_snapshot),
            to_version:to_version_id(version_number, reading_stage, status_snapshot)
          `)
          .eq('bill_id', billId)
          .order('created_at', { ascending: false });

        if (!cancelled) setDeltas((data as BillDelta[]) || []);
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [billId]);

  const hasLoopholeFlags = deltas.some(d => (d.loophole_flags || []).length > 0);

  return { deltas, loading, hasLoopholeFlags };
}
