import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BillChange {
  id: string;
  bill_id: string;
  previous_status: string | null;
  new_status: string;
  change_description: string | null;
  changed_at: string;
}

export function useBillHistory(billId: string | null) {
  const [changes, setChanges] = useState<BillChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!billId) { setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('bill_changes')
          .select('*')
          .eq('bill_id', billId)
          .order('changed_at', { ascending: false })
          .limit(20);
        setChanges((data as BillChange[]) || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [billId]);

  return { changes, loading };
}
