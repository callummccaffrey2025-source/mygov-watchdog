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
export function useReceiptTelemetry(
  storyId: number | null,
  sources: PrimarySource[],
  loading: boolean = false,
) {
  const firedRef = useRef<number | null>(null);

  useEffect(() => {
    // Wait for sources to finish loading before recording telemetry,
    // otherwise we'd record has_receipts=false while still fetching.
    if (!storyId || loading || firedRef.current === storyId) return;
    firedRef.current = storyId;

    const sourceTypes = [...new Set(sources.map(s => s.source_type))];

    trackEvent('news_read', {
      story_id: storyId,
      has_receipts: sources.length > 0,
      receipt_count: sources.length,
      source_types: sourceTypes,
    });
  }, [storyId, sources.length, loading]);
}
