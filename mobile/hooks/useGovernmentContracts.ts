import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface GovernmentContract {
  id: string;
  cn_id: string;
  agency: string;
  description: string | null;
  value: number | null;
  supplier_name: string | null;
  publish_date: string | null;
}

export interface ContractSummary {
  total_value: number;
  contract_count: number;
  top_agencies: { agency: string; total: number; count: number }[];
}

export function useGovernmentContracts(electorateId: string | undefined) {
  const [contracts, setContracts] = useState<GovernmentContract[]>([]);
  const [summary, setSummary] = useState<ContractSummary>({ total_value: 0, contract_count: 0, top_agencies: [] });
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
          .from('government_contracts')
          .select('id,cn_id,agency,description,value,supplier_name,publish_date')
          .eq('electorate_id', electorateId)
          .order('value', { ascending: false })
          .limit(50);

        if (!cancelled) {
          const rows = (data || []) as GovernmentContract[];
          setContracts(rows);

          // Compute summary
          const totalValue = rows.reduce((s, c) => s + (Number(c.value) || 0), 0);
          const agencyMap: Record<string, { total: number; count: number }> = {};
          for (const c of rows) {
            if (!agencyMap[c.agency]) agencyMap[c.agency] = { total: 0, count: 0 };
            agencyMap[c.agency].total += Number(c.value) || 0;
            agencyMap[c.agency].count += 1;
          }
          const topAgencies = Object.entries(agencyMap)
            .map(([agency, v]) => ({ agency, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

          setSummary({ total_value: totalValue, contract_count: rows.length, top_agencies: topAgencies });
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [electorateId]);

  return { contracts, summary, loading };
}
