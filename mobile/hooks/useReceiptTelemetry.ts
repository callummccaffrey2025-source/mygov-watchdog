import { useEffect, useRef } from 'react';
import { trackEvent } from '../lib/engagementTracker';
import { PrimarySource } from './useStoryPrimarySources';

/**
 * Fires a telemetry event when a story detail screen opens.
 * Tracks whether the story has parliamentary receipts (primary sources)
 * and what types are present — for post-launch coverage analysis.
 *
 * Fires once per story view (deduplicated by storyId).
 */
export function useReceiptTelemetry(storyId: number | null, sources: PrimarySource[]) {
  const firedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!storyId || firedRef.current === storyId) return;
    // Wait until sources have loaded (empty array on first render is expected,
    // but we want to track the final state). Fire on any non-null storyId
    // after sources settle — even if sources is empty (that's a valid signal).
    firedRef.current = storyId;

    const sourceTypes = [...new Set(sources.map(s => s.source_type))];

    trackEvent('news_read', {
      story_id: storyId,
      has_receipts: sources.length > 0,
      receipt_count: sources.length,
      source_types: sourceTypes,
    });
  }, [storyId, sources]);
}
