import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface LocalAnnouncement {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  electorate_id: string | null;
  state: string | null;
  member_id: string | null;
  budget_amount: string | null;
  announced_at: string | null;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    party: { colour: string | null; short_name: string | null } | null;
  } | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  infrastructure: '🏗️',
  health: '🏥',
  education: '📚',
  environment: '🌿',
  housing: '🏠',
  economy: '💰',
  community: '🤝',
};

export function getCategoryIcon(category: string | null): string {
  return CATEGORY_ICONS[category || ''] || '📋';
}

export function useLocalAnnouncements(
  electorateId: string | undefined,
  state: string | undefined,
) {
  const [announcements, setAnnouncements] = useState<LocalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electorateId && !state) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const run = async () => {
      let data: LocalAnnouncement[] = [];

      // Try electorate-specific first
      if (electorateId) {
        const { data: rows } = await supabase
          .from('local_announcements')
          .select('*, member:members(first_name,last_name,party:parties(colour,short_name))')
          .eq('electorate_id', electorateId)
          .order('announced_at', { ascending: false })
          .limit(6);
        data = rows || [];
      }

      // Fall back to state-level if fewer than 2 electorate-specific
      if (data.length < 2 && state) {
        const { data: stateRows } = await supabase
          .from('local_announcements')
          .select('*, member:members(first_name,last_name,party:parties(colour,short_name))')
          .eq('state', state)
          .is('electorate_id', null)
          .order('announced_at', { ascending: false })
          .limit(6);
        data = [...data, ...(stateRows || [])].slice(0, 6);
      }

      setAnnouncements(data);
      setLoading(false);
    };

    run();
  }, [electorateId, state]);

  return { announcements, loading };
}
