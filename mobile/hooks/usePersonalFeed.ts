import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from './useElectorateByPostcode';
import { useUserIssues } from './useUserIssues';
import { useIssues } from './useIssues';
import { NewsStory } from './useNewsStories';
import { filterPoliticalStories } from './usePersonalisedFeed';
import { scoreStory, RelevanceContext } from './useRelevanceScore';

/**
 * Upgraded personal feed hook.
 * Scores and partitions stories into five tab feeds using full RelevanceContext.
 */
export function usePersonalFeed(stories: NewsStory[]) {
  const { user, postcode } = useUser();
  const { electorate, member } = useElectorateByPostcode(postcode);
  const { selectedIssues } = useUserIssues(user?.id ?? null);
  const { issues } = useIssues();
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [housingStatus, setHousingStatus] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<number>>(new Set());
  const [dismissedStoryIds, setDismissedStoryIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load followed topics from AsyncStorage (set during onboarding)
  useEffect(() => {
    AsyncStorage.getItem('selected_topics').then(raw => {
      if (raw) {
        try { setFollowedTopics(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, []);

  // Load housing status from user_preferences
  useEffect(() => {
    const load = async () => {
      try {
        if (user?.id) {
          const { data } = await supabase
            .from('user_preferences')
            .select('housing_status')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data?.housing_status) setHousingStatus(data.housing_status);
        }
      } catch { /* non-critical */ }
    };
    load();
  }, [user?.id]);

  // Load viewed / dismissed story IDs from user_interactions (last 7 days)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const deviceId = await AsyncStorage.getItem('device_id');
        const identifier = user?.id || deviceId;
        if (!identifier) { setLoading(false); return; }

        const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

        let query = supabase
          .from('user_interactions')
          .select('entity_id, interaction_type')
          .eq('entity_type', 'story')
          .in('interaction_type', ['view', 'dismiss'])
          .gte('created_at', sevenDaysAgo);

        if (user?.id) {
          query = query.eq('user_id', user.id);
        } else {
          query = query.eq('device_id', deviceId!);
        }

        const { data } = await query;

        if (!cancelled && data) {
          const viewed = new Set<number>();
          const dismissed = new Set<number>();
          for (const row of data) {
            const id = parseInt(row.entity_id, 10);
            if (isNaN(id)) continue;
            if (row.interaction_type === 'view') viewed.add(id);
            if (row.interaction_type === 'dismiss') dismissed.add(id);
          }
          setViewedStoryIds(viewed);
          setDismissedStoryIds(dismissed);
        }
      } catch {
        // Non-critical — feed still works without interaction history
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Derive issue categories from selected issue IDs + issues master list
  const followedIssueCategories = useMemo(() => {
    if (selectedIssues.length === 0 || issues.length === 0) return [];
    const issueMap = new Map(issues.map(i => [i.id, i]));
    return selectedIssues
      .map(id => issueMap.get(id)?.category)
      .filter((c): c is string => !!c);
  }, [selectedIssues, issues]);

  // Build the relevance context
  const mpName = member ? `${member.first_name} ${member.last_name}` : null;
  const electorateName = electorate?.name ?? null;
  const state = electorate?.state ?? null;

  const ctx: RelevanceContext = useMemo(() => ({
    electorate: electorateName,
    mpName,
    followedTopics,
    followedIssueCategories,
    housingStatus,
    state,
    viewedStoryIds,
    dismissedStoryIds,
  }), [
    electorateName,
    mpName,
    followedTopics.join(','),
    followedIssueCategories.join(','),
    housingStatus,
    state,
    viewedStoryIds,
    dismissedStoryIds,
  ]);

  // Score, partition, and sort stories
  const result = useMemo(() => {
    const political = filterPoliticalStories(stories);
    const scored = political.map(story => {
      const { score, reason } = scoreStory(story, ctx);
      return { story, score, reason };
    });

    // Build relevance reasons map
    const relevanceReasons = new Map<number, string>();
    for (const { story, reason } of scored) {
      if (reason) relevanceReasons.set(story.id, reason);
    }

    // forYou: sorted by relevance score
    const forYou = [...scored]
      .sort((a, b) => b.score - a.score)
      .map(({ story }) => story);

    // trending: sorted by article_count (unpersonalised)
    const trending = [...political].sort(
      (a, b) => b.article_count - a.article_count
    );

    // yourElectorate: stories mentioning electorate or MP in headline
    const yourElectorate = political.filter(s => {
      const h = s.headline.toLowerCase();
      if (electorateName && h.includes(electorateName.toLowerCase())) return true;
      if (mpName && h.includes(mpName.toLowerCase())) return true;
      return false;
    });

    // yourIssues: stories whose category matches any followed issue category
    const issueCatSet = new Set(followedIssueCategories.map(c => c.toLowerCase()));
    const yourIssues = political.filter(
      s => s.category && issueCatSet.has(s.category.toLowerCase())
    );

    // yourMP: stories mentioning MP name in headline
    const yourMP = mpName
      ? political.filter(s => s.headline.toLowerCase().includes(mpName.toLowerCase()))
      : [];

    return { forYou, yourElectorate, yourIssues, yourMP, trending, relevanceReasons };
  }, [stories, ctx, electorateName, mpName, followedIssueCategories]);

  return { ...result, loading };
}
