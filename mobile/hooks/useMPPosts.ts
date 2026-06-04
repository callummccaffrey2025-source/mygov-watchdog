import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MPPost {
  id: string;
  member_id: string;
  title: string | null;
  body: string;
  post_type: string;
  topic: string | null;
  bill_id: string | null;
  agree_count: number;
  disagree_count: number;
  insightful_count: number;
  is_pinned: boolean;
  created_at: string;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    party?: { name: string; short_name: string; colour: string } | null;
    electorate?: { name: string; state: string } | null;
  } | null;
}

export function useMPPosts(memberId?: string | null, limit = 20) {
  const [posts, setPosts] = useState<MPPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('mp_posts')
        .select('*, member:members(id, first_name, last_name, photo_url, party:parties(name, short_name, colour), electorate:electorates!members_electorate_id_fkey(name, state))')
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (memberId) {
        query = query.eq('member_id', memberId);
      }

      const { data, error: err } = await query;
      if (err) { setError(err.message); }
      else { setPosts((data as unknown as MPPost[]) || []); setError(null); }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [memberId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { posts, loading, error, refresh: fetch };
}
