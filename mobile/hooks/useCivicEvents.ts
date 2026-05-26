/**
 * Civic event logger — fire-and-forget event capture for longitudinal tracking.
 * Prompt 11: substrate for Wrapped and constituent-pressure aggregation.
 *
 * Event types:
 *   stance_set, stance_changed, match_viewed, poll_voted, bill_viewed,
 *   prediction_made, prediction_revealed, share_generated, daily_streak
 */
import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '../lib/storage';
import { useUser } from '../context/UserContext';

export type CivicEventType =
  | 'stance_set'
  | 'stance_changed'
  | 'match_viewed'
  | 'poll_voted'
  | 'bill_viewed'
  | 'prediction_made'
  | 'prediction_revealed'
  | 'share_generated'
  | 'daily_streak'
  | 'mp_contacted'
  | 'biggest_gap_seen';

export function useCivicEvents() {
  const { user } = useUser();
  const deviceIdRef = useRef<string | null>(null);

  const log = useCallback(async (eventType: CivicEventType, payload: Record<string, any> = {}) => {
    try {
      if (!deviceIdRef.current) {
        deviceIdRef.current = await AsyncStorage.getItem('device_id');
      }
      if (!deviceIdRef.current) return;

      // Fire and forget — never block UI
      supabase.from('civic_events').insert({
        device_id: deviceIdRef.current,
        user_id: user?.id ?? null,
        event_type: eventType,
        payload,
      }).then(() => {});
    } catch {
      // Silently fail — civic events are non-critical
    }
  }, [user?.id]);

  return { log };
}
