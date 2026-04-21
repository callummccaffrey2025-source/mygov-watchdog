import { useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export type InteractionType = 'view' | 'click' | 'share' | 'bookmark' | 'dismiss' | 'search';
export type EntityType = 'story' | 'bill' | 'member' | 'party' | 'issue' | 'post';

const VIEW_DEDUP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fire-and-forget hook for logging user interactions to user_interactions.
 * Deduplicates 'view' events within a 5-minute window per entity.
 */
export function useTrackInteraction() {
  const { user } = useUser();
  // Map of "entityType:entityId" → last view timestamp for dedup
  const recentViews = useRef<Map<string, number>>(new Map());

  const trackInteraction = useCallback(
    (
      type: InteractionType,
      entityType: EntityType,
      entityId: string,
      metadata?: Record<string, unknown>,
    ) => {
      // Dedup views within 5 minutes
      if (type === 'view') {
        const key = `${entityType}:${entityId}`;
        const lastView = recentViews.current.get(key);
        if (lastView && Date.now() - lastView < VIEW_DEDUP_MS) return;
        recentViews.current.set(key, Date.now());
      }

      // Fire-and-forget insert
      (async () => {
        try {
          const deviceId = await AsyncStorage.getItem('device_id');
          await supabase.from('user_interactions').insert({
            user_id: user?.id ?? null,
            device_id: deviceId ?? null,
            interaction_type: type,
            entity_type: entityType,
            entity_id: entityId,
            metadata: metadata ?? null,
          });
        } catch {
          // Silent — interaction logging must never block or throw
        }
      })();
    },
    [user?.id],
  );

  return { trackInteraction };
}
