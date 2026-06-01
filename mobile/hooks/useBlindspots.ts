import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PublicSentimentData {
  sentiment_summary: string;
  reddit_signal: string;
  best_takes: string[];
  ran_at: string;
  divergence_score: number;
}

export interface BlindspotStory {
  id: number;
  headline: string;
  article_count: number;
  left_count: number;
  center_count: number;
  right_count: number;
  blindspot_side: 'left' | 'right';
  coverage_pct: number;
  missing_side_label: string;
  public_sentiment_data: PublicSentimentData | null;
}

export function useBlindspots() {
  const [stories, setStories] = useState<BlindspotStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('news_stories')
          .select('id,headline,article_count,left_count,center_count,right_count,public_sentiment_data')
          .gte('article_count', 3)
          .order('article_count', { ascending: false })
          .limit(100);

        if (cancelled) return;
        if (!data) { setLoading(false); return; }

        const blindspots: BlindspotStory[] = [];
        for (const s of data) {
          const total = s.left_count + s.center_count + s.right_count;
          if (total < 3) continue;

          const leftPct = s.left_count / total;
          const rightPct = s.right_count / total;

          // True blindspot: one side has zero or near-zero coverage
          if (s.right_count === 0 && s.left_count > 0) {
            blindspots.push({
              ...s,
              blindspot_side: 'right',
              coverage_pct: Math.round(leftPct * 100),
              missing_side_label: 'No right-leaning sources covered this story',
            });
          } else if (s.left_count === 0 && s.right_count > 0) {
            blindspots.push({
              ...s,
              blindspot_side: 'left',
              coverage_pct: Math.round(rightPct * 100),
              missing_side_label: 'No left-leaning sources covered this story',
            });
          } else if (leftPct >= 0.6 && rightPct <= 0.1) {
            blindspots.push({
              ...s,
              blindspot_side: 'right',
              coverage_pct: Math.round(leftPct * 100),
              missing_side_label: `${Math.round(leftPct * 100)}% of coverage from left-leaning sources`,
            });
          } else if (rightPct >= 0.6 && leftPct <= 0.1) {
            blindspots.push({
              ...s,
              blindspot_side: 'left',
              coverage_pct: Math.round(rightPct * 100),
              missing_side_label: `${Math.round(rightPct * 100)}% of coverage from right-leaning sources`,
            });
          }
        }

        if (!cancelled) setStories(blindspots.slice(0, 5));
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { stories, loading };
}
