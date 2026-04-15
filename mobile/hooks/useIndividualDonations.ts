import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface IndividualDonation {
  id: string;
  donor_name: string;
  donor_type: string | null;
  amount: number;
  financial_year: string;
  receipt_type: string | null;
  recipient_name: string | null;
}

export function useIndividualDonations(memberId: string | undefined) {
  const [donations, setDonations] = useState<IndividualDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    supabase
      .from('individual_donations')
      .select('id,donor_name,donor_type,amount,financial_year,receipt_type,recipient_name')
      .eq('member_id', memberId)
      .order('amount', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data || []) as IndividualDonation[];
        setDonations(rows);
        setTotal(rows.reduce((s, d) => s + Number(d.amount), 0));
        setLoading(false);
      });
  }, [memberId]);

  return { donations, total, loading };
}
