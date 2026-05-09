import { useState, useEffect } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { hapticLight } from '../lib/haptics';

export type FollowEntityType = 'bill' | 'member' | 'topic';

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
    } catch {
      setFollowing(!next); // revert on error
    }
  };

  return { following, loading, toggle };
}
