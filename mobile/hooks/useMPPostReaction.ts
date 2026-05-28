import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export type ReactionType = 'agree' | 'disagree' | 'insightful';

export function useMPPostReaction(postId: string) {
  const { user } = useUser();
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch current user's reaction
  useEffect(() => {
    if (!user || !postId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('mp_post_reactions')
        .select('reaction_type')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setMyReaction(data.reaction_type as ReactionType);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, postId]);

  const react = useCallback(async (type: ReactionType) => {
    if (!user || loading) return false;
    setLoading(true);

    const previous = myReaction;

    if (myReaction === type) {
      // Unreact: remove the reaction
      setMyReaction(null);
      const { error } = await supabase
        .from('mp_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (error) { setMyReaction(previous); setLoading(false); return false; }
    } else if (myReaction) {
      // Switch reaction
      setMyReaction(type);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase
        .from('mp_post_reactions')
        .update({ reaction_type: type })
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (error) { setMyReaction(previous); setLoading(false); return false; }
    } else {
      // New reaction
      setMyReaction(type);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase
        .from('mp_post_reactions')
        .insert({ post_id: postId, user_id: user.id, reaction_type: type });
      if (error) { setMyReaction(previous); setLoading(false); return false; }
    }

    setLoading(false);
    return true;
  }, [user?.id, postId]);

  return { myReaction, react, loading };
}
