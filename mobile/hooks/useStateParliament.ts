import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface StateMember {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  party: string | null;
  electorate: string | null;
  chamber: string | null;
  state: string;
  photo_url: string | null;
  role: string | null;
}

export interface StateBill {
  id: string;
  title: string;
  status: string | null;
  introduced_date: string | null;
  chamber: string | null;
  state: string;
  summary: string | null;
  source_url: string | null;
  external_id: string | null;
}

export function useStateMembers(state: string, search?: string) {
  const [members, setMembers] = useState<StateMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state || state === 'Federal') { setMembers([]); return; }
    setLoading(true);
    let q = supabase
      .from('state_members')
      .select('id,name,first_name,last_name,party,electorate,chamber,state,photo_url,role')
      .eq('state', state)
      .order('last_name')
      .limit(search ? 10 : 30);
    if (search && search.length > 1) {
      q = q.ilike('name', `%${search}%`);
    }
    q.then(({ data }) => {
      setMembers((data || []) as StateMember[]);
      setLoading(false);
    });
  }, [state, search]);

  return { members, loading };
}

export function useStateBills(state: string, search?: string) {
  const [bills, setBills] = useState<StateBill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state || state === 'Federal') { setBills([]); return; }
    setLoading(true);
    let q = supabase
      .from('state_bills')
      .select('id,title,status,introduced_date,chamber,state,summary,source_url,external_id')
      .eq('state', state)
      .order('introduced_date', { ascending: false })
      .limit(search ? 10 : 20);
    if (search && search.length > 1) {
      q = q.ilike('title', `%${search}%`);
    }
    q.then(({ data }) => {
      setBills((data || []) as StateBill[]);
      setLoading(false);
    });
  }, [state, search]);

  return { bills, loading };
}
