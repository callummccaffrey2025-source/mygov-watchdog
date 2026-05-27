import { useState, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface TopicFollow {
  topic: string;
  notify_on_vote: boolean;
  notify_on_bill: boolean;
}

export function useTopicFollows() {
  const { user } = useUser();
  const [follows, setFollows] = useState<TopicFollow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_topic_follows')
      .select('topic, notify_on_vote, notify_on_bill')
      .eq('user_id', user.id);
    setFollows((data as TopicFollow[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const followedTopics = new Set(follows.map(f => f.topic));

  const toggleTopic = useCallback(async (topic: string) => {
    if (!user) return;
    if (followedTopics.has(topic)) {
      // Unfollow
      await supabase.from('user_topic_follows').delete().eq('user_id', user.id).eq('topic', topic);
      setFollows(prev => prev.filter(f => f.topic !== topic));
    } else {
      // Follow
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await supabase.from('user_topic_follows').insert({ user_id: user.id, topic });
      setFollows(prev => [...prev, { topic, notify_on_vote: true, notify_on_bill: true }]);
    }
  }, [user?.id, followedTopics]);

  const isFollowing = useCallback((topic: string) => followedTopics.has(topic), [followedTopics]);

  return { follows, loading, toggleTopic, isFollowing, refresh: fetch };
}
