import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  party_id: string | null;
  electorate_id: string | null;
  chamber: string;
  level: string;
  photo_url: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  aph_id: string | null;
  ministerial_role: string | null;
  party?: { name: string; short_name: string; colour: string; abbreviation: string };
  electorate?: { name: string; state: string };
}

interface Filters {
  partyId?: string;
  electorateId?: string;
  chamber?: string;
  search?: string;
  limit?: number;
}

export function useMembers(filters: Filters = {}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetch = async () => {
      try {
        let query = supabase
          .from('members')
          .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
          .eq('is_active', true)
          .order('last_name');

        if (filters.partyId) query = query.eq('party_id', filters.partyId);
        if (filters.electorateId) query = query.eq('electorate_id', filters.electorateId);
        if (filters.chamber) query = query.eq('chamber', filters.chamber);
        if (filters.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
        if (filters.limit) query = query.limit(filters.limit);

        const { data, error: err } = await query;
        if (!cancelled) {
          if (err) setError(err.message);
          else setMembers(data || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [filters.partyId, filters.electorateId, filters.chamber, filters.search, filters.limit]);

  return { members, loading, error };
}
