import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type CommunityPost = {
  id: string;
  user_id: string | null;
  device_id: string | null;
  electorate: string;
  title: string;
  body: string;
  post_type: string;
  topic: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string | null;
  device_id: string | null;
  body: string;
  upvotes: number;
  created_at: string;
};

export function useCommunityPosts(
  electorate: string | null,
  tab: 'latest' | 'top' | 'mine',
  deviceId: string | null,
  userId: string | null | undefined
) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!electorate) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from('community_posts')
      .select('*')
      .eq('electorate', electorate)
      .eq('is_removed', false);

    if (tab === 'latest') {
      q = q.order('created_at', { ascending: false }).limit(30);
    } else if (tab === 'top') {
      q = q.order('upvotes', { ascending: false }).limit(30);
    } else if (tab === 'mine') {
      // posts by this device or user
      if (userId && deviceId) {
        q = q.or(`user_id.eq.${userId},device_id.eq.${deviceId}`).limit(30);
      } else if (userId) {
        q = q.eq('user_id', userId).limit(30);
      } else if (deviceId) {
        q = q.eq('device_id', deviceId).limit(30);
      }
    }

    const { data } = await q;
    setPosts((data as CommunityPost[]) ?? []);
    setLoading(false);
  }, [electorate, tab, deviceId, userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { posts, loading, refresh: fetch };
}

export function useCommunityComments(postId: string | null) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!postId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('community_comments')
      .select('*')
      .eq('post_id', postId)
      .eq('is_removed', false)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(100);
    setComments((data as CommunityComment[]) ?? []);
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { comments, loading, refresh: fetch };
}
