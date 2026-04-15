import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { hapticLight } from '../lib/haptics';

export function useCommunityVote(
  targetType: 'post' | 'comment',
  targetId: string,
  deviceId: string | null,
  userId: string | null | undefined
) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!targetId || (!deviceId && !userId)) return;
    const loadVote = async () => {
      let q = supabase
        .from('community_votes')
        .select('vote_type')
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      if (deviceId) q = q.eq('device_id', deviceId);
      else if (userId) q = q.eq('user_id', userId);
      const { data } = await q.maybeSingle();
      if (data) setVote(data.vote_type as 'up' | 'down');
    };
    loadVote();
  }, [targetType, targetId, deviceId, userId]);

  const toggle = async (type: 'up' | 'down') => {
    if (!deviceId && !userId) return;
    const prev = vote;
    const next = vote === type ? null : type;
    setVote(next); // optimistic
    hapticLight();

    try {
      if (next === null) {
        // Remove vote
        let q = supabase
          .from('community_votes')
          .delete()
          .eq('target_type', targetType)
          .eq('target_id', targetId);
        if (deviceId) q = q.eq('device_id', deviceId);
        else if (userId) q = q.eq('user_id', userId);
        await q;
      } else {
        await supabase.from('community_votes').upsert(
          {
            device_id: deviceId,
            user_id: userId ?? null,
            target_type: targetType,
            target_id: targetId,
            vote_type: next,
          },
          { onConflict: 'device_id,target_type,target_id' }
        );
      }
      // Update vote counts on the parent row
      const table = targetType === 'post' ? 'community_posts' : 'community_comments';
      const { data: votes } = await supabase
        .from('community_votes')
        .select('vote_type')
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      if (votes) {
        const upvotes = votes.filter((v: any) => v.vote_type === 'up').length;
        const downvotes = votes.filter((v: any) => v.vote_type === 'down').length;
        await supabase.from(table).update({ upvotes, downvotes }).eq('id', targetId);
      }
    } catch {
      setVote(prev); // revert on error
    }
  };

  return { vote, toggle };
}
