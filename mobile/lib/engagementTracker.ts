import { supabase } from './supabase';

export type EngagementEvent =
  | 'bill_read'
  | 'mp_view'
  | 'news_read'
  | 'discussion_posted'
  | 'poll_voted'
  | 'share_created'
  | 'session_time';

/**
 * Fire-and-forget engagement tracker.
 * Calls the track-engagement Edge Function. Silently fails on any error.
 * Only tracks authenticated users — anonymous events are discarded.
 */
export function trackEvent(event_type: EngagementEvent, event_data?: Record<string, any>, seconds?: number) {
  // Non-blocking: fire and forget
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // anonymous users not tracked

      await supabase.functions.invoke('track-engagement', {
        body: { event_type, event_data, seconds },
      });
    } catch {
      // Silently ignore — never disrupt UX
    }
  })();
}
