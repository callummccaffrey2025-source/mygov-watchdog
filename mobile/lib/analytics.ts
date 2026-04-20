import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';
import { supabase } from './supabase';

/**
 * Dual analytics: Supabase (own DB) + PostHog (funnels, retention, feature flags).
 * Both fire-and-forget. Never blocks UI.
 *
 * PostHog setup: Add EXPO_PUBLIC_POSTHOG_API_KEY to .env
 * Sign up free at https://posthog.com (1M events/mo free)
 */

let _deviceId: string | null = null;
let _userId: string | null = null;
let posthog: PostHog | null = null;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** Call once on app start or auth change to set identity */
export function setAnalyticsUser(userId: string | null, deviceId: string | null) {
  _userId = userId;
  _deviceId = deviceId;
  if (posthog && userId) {
    posthog.identify(userId, { device_id: deviceId });
  }
}

/** Initialize analytics (call once at app start) */
export async function initAnalytics() {
  try {
    _deviceId = await AsyncStorage.getItem('device_id');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) _userId = user.id;

    // Initialize PostHog if key is configured
    if (POSTHOG_KEY) {
      posthog = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
      if (_userId) posthog.identify(_userId, { device_id: _deviceId });
    }
  } catch {}
}

/** Get PostHog instance (for PostHogProvider) */
export function getPostHog(): PostHog | null {
  return posthog;
}

/**
 * Track an event. Non-blocking — sends to both Supabase and PostHog.
 */
export function track(
  eventName: string,
  eventData?: Record<string, any>,
  screenName?: string,
) {
  // Supabase — own DB
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

  // PostHog — funnels, retention, feature flags
  if (posthog) {
    posthog.capture(eventName, {
      ...eventData,
      $screen_name: screenName ?? null,
    });
  }
}

/** Track screen view (called from navigation state change) */
export function trackScreen(screenName: string) {
  track('screen_view', { screen: screenName }, screenName);
  if (posthog) posthog.screen(screenName);
}
