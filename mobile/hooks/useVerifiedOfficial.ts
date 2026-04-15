import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface VerifiedOfficial {
  id: string;
  user_id: string;
  member_id: string;
  verified_at: string;
  verified_method: string;
  is_active: boolean;
}

export function useVerifiedOfficial(memberId: string | undefined) {
  const [official, setOfficial] = useState<VerifiedOfficial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    supabase
      .from('verified_officials')
      .select('*')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        setOfficial(data ?? null);
        setLoading(false);
      });
  }, [memberId]);

  return { official, loading };
}

export function useMyOfficialClaim(userId: string | undefined) {
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('verified_officials')
      .select('member_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .then(({ data }) => {
        setMemberIds((data ?? []).map((r: any) => r.member_id));
        setLoading(false);
      });
  }, [userId]);

  return { memberIds, loading };
}
