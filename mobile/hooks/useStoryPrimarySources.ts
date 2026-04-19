import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PrimarySource {
  id: string;
  story_id: number;
  source_type: 'hansard' | 'division_vote' | 'bill' | 'donation';
  source_id: string;
  member_id: string | null;
  relevance: number;
  excerpt: string | null;
  metadata: Record<string, any>;
}

export interface StoryEntity {
  id: string;
  entity_type: 'member' | 'bill' | 'party' | 'quote';
  entity_value: string;
  member_id: string | null;
  bill_id: string | null;
  confidence: number;
  raw_mention: string | null;
}

interface UseStoryPrimarySourcesResult {
  sources: PrimarySource[];
  entities: StoryEntity[];
  loading: boolean;
  hansard: PrimarySource[];
  votes: PrimarySource[];
  bills: PrimarySource[];
  donations: PrimarySource[];
}

export function useStoryPrimarySources(storyId: number | null): UseStoryPrimarySourcesResult {
  const [sources, setSources] = useState<PrimarySource[]>([]);
  const [entities, setEntities] = useState<StoryEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) {
      setSources([]);
      setEntities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [sourcesRes, entitiesRes] = await Promise.all([
          supabase
            .from('story_primary_sources')
            .select('*')
            .eq('story_id', storyId)
            .order('relevance', { ascending: false }),
          supabase
            .from('story_entities')
            .select('*')
            .eq('story_id', storyId)
            .order('confidence', { ascending: false }),
        ]);

        if (!cancelled) {
          setSources((sourcesRes.data as PrimarySource[]) || []);
          setEntities((entitiesRes.data as StoryEntity[]) || []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSources([]);
          setEntities([]);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  const hansard = sources.filter(s => s.source_type === 'hansard');
  const votes = sources.filter(s => s.source_type === 'division_vote');
  const bills = sources.filter(s => s.source_type === 'bill');
  const donations = sources.filter(s => s.source_type === 'donation');

  return { sources, entities, loading, hansard, votes, bills, donations };
}
