import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Contradiction {
  id: string;
  member_id: string;
  story_id: number | null;
  entity_id: string | null;
  claim_text: string;
  claim_source: string | null;
  claim_date: string | null;
  contra_text: string;
  contra_type: string;
  contra_date: string | null;
  hansard_id: string | null;
  confidence: number;
  ai_explanation: string;
  status: string;
  created_at: string;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    party: { name: string; short_name: string; colour: string } | null;
  };
}

interface UseContradictionsOptions {
  memberId?: string;
  storyId?: number;
}

interface UseContradictionsResult {
  contradictions: Contradiction[];
  loading: boolean;
}

export function useContradictions(options: UseContradictionsOptions): UseContradictionsResult {
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState(true);

  const { memberId, storyId } = options;

  useEffect(() => {
    if (!memberId && !storyId) {
      setContradictions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        let query = supabase
          .from('mp_contradictions')
          .select('*, member:members(id, first_name, last_name, photo_url, party:parties(name, short_name, colour))')
          .eq('status', 'confirmed')
          .order('confidence', { ascending: false });

        if (memberId) {
          query = query.eq('member_id', memberId);
        }
        if (storyId) {
          query = query.eq('story_id', storyId);
        }

        const { data, error } = await query;

        if (!cancelled) {
          if (error) {
            setContradictions([]);
          } else {
            setContradictions((data as Contradiction[]) || []);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setContradictions([]);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [memberId, storyId]);

  return { contradictions, loading };
}
