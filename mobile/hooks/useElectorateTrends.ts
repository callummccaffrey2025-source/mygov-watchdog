import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ElectorateTrends {
  mostDiscussedTopic: string | null;
  mostDiscussedPostTitle: string | null;
  mostViewedBillTitle: string | null;
  mostViewedBillId: string | null;
  activeUsers: number;
  hasEnoughData: boolean;
}

const MIN_USERS_FOR_TRENDS = 10;

export function useElectorateTrends(electorate: string | null) {
  const [trends, setTrends] = useState<ElectorateTrends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electorate) { setLoading(false); return; }

    const fetch = async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const sevenDaysAgoDate = sevenDaysAgo.slice(0, 10);

        // 1. Active users count from engagement stats in this electorate
        const { data: leaderboard } = await supabase
          .from('electorate_engagement_leaderboard')
          .select('active_users')
          .eq('electorate', electorate)
          .maybeSingle();

        const activeUsers = leaderboard?.active_users ?? 0;

        // 2. Most discussed topic/post in community (last 7 days)
        const { data: posts } = await supabase
          .from('community_posts')
          .select('id, title, topic, upvotes, comment_count')
          .eq('electorate', electorate)
          .gte('created_at', sevenDaysAgo)
          .order('comment_count', { ascending: false })
          .limit(10);

        let mostDiscussedTopic: string | null = null;
        let mostDiscussedPostTitle: string | null = null;
        if (posts?.length) {
          // Pick the post with the most engagement (comments + upvotes)
          const sorted = [...posts].sort((a, b) =>
            (b.comment_count + b.upvotes) - (a.comment_count + a.upvotes)
          );
          mostDiscussedPostTitle = sorted[0].title;

          // Topic aggregation
          const topicCounts: Record<string, number> = {};
          for (const p of posts) {
            if (p.topic) topicCounts[p.topic] = (topicCounts[p.topic] ?? 0) + 1;
          }
          const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
          if (topTopic) mostDiscussedTopic = topTopic[0];
        }

        // 3. Most viewed bill (from analytics_events bill_detail_view in this electorate)
        // We need to join analytics_events → push_tokens/user_preferences to filter by electorate
        let mostViewedBillTitle: string | null = null;
        let mostViewedBillId: string | null = null;

        try {
          // Get user IDs in this electorate
          const { data: localUsers } = await supabase
            .from('push_tokens')
            .select('user_id')
            .eq('electorate', electorate)
            .not('user_id', 'is', null);

          const userIds = (localUsers || []).map((u: any) => u.user_id).filter(Boolean);

          if (userIds.length > 0) {
            const { data: billViews } = await supabase
              .from('analytics_events')
              .select('event_data')
              .eq('event_name', 'bill_detail_view')
              .in('user_id', userIds)
              .gte('created_at', sevenDaysAgo);

            // Count bill_id occurrences
            const billCounts: Record<string, { count: number; title: string }> = {};
            for (const v of (billViews || [])) {
              const bid = v.event_data?.bill_id;
              const title = v.event_data?.title;
              if (bid) {
                if (billCounts[bid]) billCounts[bid].count++;
                else billCounts[bid] = { count: 1, title: title || '' };
              }
            }
            const topBill = Object.entries(billCounts).sort((a, b) => b[1].count - a[1].count)[0];
            if (topBill) {
              mostViewedBillId = topBill[0];
              mostViewedBillTitle = topBill[1].title;
            }
          }
        } catch {}

        setTrends({
          mostDiscussedTopic,
          mostDiscussedPostTitle,
          mostViewedBillTitle,
          mostViewedBillId,
          activeUsers,
          hasEnoughData: activeUsers >= MIN_USERS_FOR_TRENDS,
        });
      } catch {}
      setLoading(false);
    };

    fetch();
  }, [electorate]);

  return { trends, loading };
}
