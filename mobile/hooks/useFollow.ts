import { useState, useEffect } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';

export type FollowEntityType = 'bill' | 'member' | 'topic' | 'party';

export function useFollow(entityType: FollowEntityType, entityId: string) {
  const { user } = useUser();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setLoading(true);
      try {
        const deviceId = await AsyncStorage.getItem('device_id');

        let query = supabase
          .from('user_follows')
          .select('id')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId);

        if (user) {
          query = query.eq('user_id', user.id);
        } else if (deviceId) {
          query = (query as any).eq('device_id', deviceId).is('user_id', null);
        } else {
          if (!cancelled) { setFollowing(false); setLoading(false); }
          return;
        }

        const { data } = await (query as any).maybeSingle();
        if (!cancelled) setFollowing(!!data);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [entityType, entityId, user?.id]);

  const toggle = async () => {
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!user && !deviceId) return;

    const next = !following;
    setFollowing(next); // optimistic
    hapticLight();

    try {
      if (!next) {
        // Remove
        let query = supabase
          .from('user_follows')
          .delete()
          .eq('entity_type', entityType)
          .eq('entity_id', entityId);

        if (user) {
          query = query.eq('user_id', user.id);
        } else {
          query = (query as any).eq('device_id', deviceId!);
        }
        const { error } = await (query as any);
        if (error) setFollowing(!next);
      } else {
        // Add
        const { error } = await supabase.from('user_follows').insert({
          user_id: user?.id ?? null,
          device_id: deviceId ?? null,
          entity_type: entityType,
          entity_id: entityId,
        });
        if (error) setFollowing(!next);
      }

      // Log to analytics
      track(next ? 'watchlist_follow' : 'watchlist_unfollow', {
        entity_type: entityType,
        entity_id: entityId,
      }, 'Watchlist');

      // Log to civic_events (fire and forget)
      Promise.resolve(
        supabase.from('civic_events').insert({
          device_id: deviceId,
          user_id: user?.id ?? null,
          event_type: next ? 'follow' : 'unfollow',
          payload: { entity_type: entityType, entity_id: entityId },
        })
      ).catch(() => {});
    } catch {
      setFollowing(!next); // revert on error
    }
  };

  return { following, loading, toggle };
}
