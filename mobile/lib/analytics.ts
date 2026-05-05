import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Lightweight analytics — fires and forgets to Supabase.
 * Never blocks UI. Silently drops events on failure.
 *
 * Table: analytics_events
 *   id uuid PK default gen_random_uuid()
 *   user_id uuid nullable
 *   device_id text nullable
 *   event_name text not null
 *   event_data jsonb default '{}'
 *   screen_name text nullable
 *   created_at timestamptz default now()
 */

let _deviceId: string | null = null;
let _userId: string | null = null;

/** Call once on app start or auth change to set identity */
export function setAnalyticsUser(userId: string | null, deviceId: string | null) {
  _userId = userId;
  _deviceId = deviceId;
}

/** Initialize device ID from AsyncStorage (call once at app start) */
export async function initAnalytics() {
  try {
    _deviceId = await AsyncStorage.getItem('device_id');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) _userId = user.id;
  } catch {}
}

/**
 * Track an event. Non-blocking — returns immediately.
 */
export function track(
  eventName: string,
  eventData?: Record<string, any>,
  screenName?: string,
) {
  // Fire and forget — don't await, don't catch
  Promise.resolve(
    supabase
      .from('analytics_events')
      .insert({
        user_id: _userId,
        device_id: _deviceId,
        event_name: eventName,
        event_data: eventData ?? {},
        screen_name: screenName ?? null,
      })
  ).catch(() => {});
}

/** Track screen view (called from navigation state change) */
export function trackScreen(screenName: string) {
  track('screen_view', { screen: screenName }, screenName);
}
