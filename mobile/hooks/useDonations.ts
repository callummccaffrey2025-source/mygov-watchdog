import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Donation {
  id: string;
  donor_name: string;
  donor_type: 'individual' | 'organisation' | 'union' | 'corporation';
  amount: number;
  financial_year: string;
  party_id: string | null;
}

const DONOR_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  organisation: 'Organisation',
  union: 'Union',
  corporation: 'Corporation',
};

export { DONOR_TYPE_LABELS };

export function usePartyDonations(partyId: string | undefined) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (!partyId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('donations')
          .select('id,donor_name,donor_type,amount,financial_year,party_id')
          .eq('party_id', partyId)
          .order('amount', { ascending: false })
          .limit(20);
        if (!cancelled) {
          const rows = (data as Donation[]) || [];
          setDonations(rows);
          setTotalAmount(rows.reduce((sum, d) => sum + Number(d.amount), 0));
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [partyId]);

  return { donations, loading, totalAmount };
}
