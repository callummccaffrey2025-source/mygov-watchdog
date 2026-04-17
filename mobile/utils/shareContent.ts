import { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/engagementTracker';

export type ShareContentType = 'mp_vote' | 'news_story' | 'mp_report_card' | 'bill';

/**
 * Captures a hidden React Native view as a PNG and opens the system share sheet.
 * Also logs a share_event for analytics.
 */
export async function captureAndShare(
  ref: RefObject<any>,
  contentType: ShareContentType,
  contentId: string | null,
  userId: string | null | undefined,
): Promise<void> {
  try {
    // Small delay to ensure the view has fully rendered
    await new Promise<void>(resolve => setTimeout(resolve, 80));

    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share via',
      UTI: 'public.png',
    });

    // Fire-and-forget analytics
    supabase.from('share_events').insert({
      content_type: contentType,
      content_id: contentId,
      user_id: userId ?? null,
    }).then(() => {/* no-op */});

    // Track in daily engagement
    trackEvent('share_created', { content_type: contentType, content_id: contentId });
  } catch {
    // Non-critical — silently ignore capture/share failures
  }
}
