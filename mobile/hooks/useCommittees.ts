import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface CommitteeMembership {
  id: string;
  committee_name: string;
  committee_type: string | null;
  role: string;
  start_date: string | null;
  end_date: string | null;
}

export function useCommittees(memberId: string | undefined) {
  const [current, setCurrent] = useState<CommitteeMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    supabase
      .from('committee_memberships')
      .select('id,committee_name,committee_type,role,start_date,end_date')
      .eq('member_id', memberId)
      .is('end_date', null)
      .order('role')
      .then(({ data }) => {
        setCurrent((data || []) as CommitteeMembership[]);
        setLoading(false);
      });
  }, [memberId]);

  return { current, loading };
}
