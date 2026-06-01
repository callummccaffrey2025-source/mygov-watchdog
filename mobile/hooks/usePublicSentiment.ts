import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PublicSentimentData {
  sentiment_summary: string;
  reddit_signal: string;
  best_takes: string[];
  ran_at: string;
  divergence_score: number;
}

export interface MPDiscourseData {
  sentiment_summary: string;
  reddit_signal: string;
  x_signal: string;
  best_takes: string[];
  sources_searched: string[];
  ran_at: string;
}

/**
 * Fetch public sentiment data for a news story (from /last30days pipeline).
 * Returns null if no data has been injected yet.
 */
export function usePublicSentiment(storyId: number | null) {
  const [data, setData] = useState<PublicSentimentData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: row } = await supabase
          .from('news_stories')
          .select('public_sentiment_data')
          .eq('id', storyId)
          .maybeSingle();

        if (!cancelled && row?.public_sentiment_data) {
          setData(row.public_sentiment_data as PublicSentimentData);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  return { data, loading };
}

/**
 * Fetch public discourse data for an MP (from /last30days MP research pipeline).
 * Returns null if no data has been injected yet.
 */
export function useMPDiscourse(memberId: string | undefined) {
  const [data, setData] = useState<MPDiscourseData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: row } = await supabase
          .from('members')
          .select('public_discourse_data, public_discourse_updated_at')
          .eq('id', memberId)
          .maybeSingle();

        if (!cancelled && row?.public_discourse_data) {
          setData(row.public_discourse_data as MPDiscourseData);
          setUpdatedAt(row.public_discourse_updated_at);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { data, updatedAt, loading };
}
