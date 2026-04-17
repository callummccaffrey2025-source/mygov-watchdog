import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface OfficialPost {
  id: string;
  author_id: string;
  author_type: string;
  content: string;
  post_type: 'update' | 'announcement' | 'opinion' | 'event' | 'policy';
  media_urls: string[] | null;
  bill_id: string | null;
  electorate_id: string | null;
  is_pinned: boolean;
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    party: {
      name: string;
      short_name: string | null;
      colour: string | null;
      abbreviation: string | null;
    } | null;
  } | null;
  bill: {
    id: string;
    title: string;
    short_title: string | null;
    current_status: string | null;
  } | null;
}

const POST_SELECT =
  '*, author:members(id,first_name,last_name,photo_url,party:parties(name,short_name,colour,abbreviation)), bill:bills(id,title,short_title,current_status)';

export function useOfficialPosts() {
  const [posts, setPosts] = useState<OfficialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('official_posts')
          .select(POST_SELECT)
          .eq('attribution_verified', true)
          .order('created_at', { ascending: false })
          .limit(8);
        if (!cancelled && !error && data) {
          setPosts((data as unknown as OfficialPost[]) || []);
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { posts, loading };
}

export function usePostsByMember(memberId: string | undefined) {
  const [posts, setPosts] = useState<OfficialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('official_posts')
          .select(POST_SELECT)
          .eq('author_id', memberId)
          .eq('attribution_verified', true)
          .order('created_at', { ascending: false });
        if (!cancelled) setPosts((data as unknown as OfficialPost[]) || []);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  return { posts, loading };
}
