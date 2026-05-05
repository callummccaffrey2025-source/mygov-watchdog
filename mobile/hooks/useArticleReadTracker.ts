import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Tracks when a user opens a news story detail screen.
 * Inserts into article_reads for the media diet feature.
 * Fire-and-forget — never blocks UI.
 */
export function useArticleReadTracker(
  storyId: number | undefined,
  userId: string | null | undefined,
) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!storyId || tracked.current) return;
    tracked.current = true;

    // Fire and forget — don't await
    if (userId) {
      Promise.resolve(
        supabase.from('article_reads').insert({
          user_id: userId,
          story_id: storyId,
          source_name: null, // Story-level read, not article-level
          source_bias: null,
        })
      ).catch(() => {});
    }
  }, [storyId, userId]);
}

/**
 * Track a specific article read (when user taps through to external URL).
 * Call this imperatively, not as a hook.
 */
export function trackArticleRead(
  articleId: number,
  storyId: number,
  sourceName: string,
  sourceBias: string | null,
  userId: string | null,
) {
  if (!userId) return;
  Promise.resolve(
    supabase.from('article_reads').insert({
      user_id: userId,
      article_id: articleId,
      story_id: storyId,
      source_name: sourceName,
      source_bias: sourceBias,
    })
  ).catch(() => {});
}
