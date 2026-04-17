import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { hapticLight } from '../lib/haptics';

export function useReactions(targetType: string, targetId: string | null) {
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!targetId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('reactions')
        .select('reaction')
        .eq('target_type', targetType)
        .eq('target_id', targetId);

      setLikes((data || []).filter(r => r.reaction === 'like').length);
      setDislikes((data || []).filter(r => r.reaction === 'dislike').length);
    } catch {
      // leave counts as-is
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [targetId]);

  const react = async (reaction: 'like' | 'dislike') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !targetId) return;
    hapticLight();

    if (userReaction === reaction) {
      await supabase.from('reactions').delete()
        .eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId);
      setUserReaction(null);
    } else {
      await supabase.from('reactions').upsert({
        user_id: user.id, target_type: targetType, target_id: targetId, reaction
      }, { onConflict: 'user_id,target_type,target_id' });
      setUserReaction(reaction);
    }
    refresh();
  };

  return { likes, dislikes, userReaction, loading, react };
}
