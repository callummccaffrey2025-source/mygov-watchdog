import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Councillor {
  id: string;
  name: string;
  ward: string | null;
  role: string | null;
}

const ROLE_ORDER: Record<string, number> = {
  'Lord Mayor': 0,
  'Mayor': 0,
  'Deputy Lord Mayor': 1,
  'Deputy Mayor': 1,
  'Councillor': 2,
};

function roleRank(role: string | null): number {
  return role ? (ROLE_ORDER[role] ?? 2) : 2;
}

export function useCouncillors(councilId: string | undefined) {
  const [councillors, setCouncillors] = useState<Councillor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!councilId) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('councillors')
      .select('id,name,ward,role')
      .eq('council_id', councilId)
      .then(({ data }) => {
        const sorted = ((data || []) as Councillor[]).sort(
          (a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name)
        );
        setCouncillors(sorted);
        setLoading(false);
      });
  }, [councilId]);

  return { councillors, loading };
}
