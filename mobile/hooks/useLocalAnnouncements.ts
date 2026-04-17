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
  // NOT NULL in the DB as of migration_local_announcements.sql.
  // Legacy unsourced rows (if any) are filtered out via .not('source_url', 'is', null).
  source_url: string;
  // 'infrastructure' | 'grants' | 'ministerial_statement' — which pipeline produced the row.
  source: string | null;
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
    let cancelled = false;

    const run = async () => {
      try {
        let data: LocalAnnouncement[] = [];

        if (electorateId) {
          const { data: rows } = await supabase
            .from('local_announcements')
            .select('*, member:members(first_name,last_name,party:parties(colour,short_name))')
            .eq('electorate_id', electorateId)
            .not('source_url', 'is', null)
            .order('announced_at', { ascending: false })
            .limit(6);
          data = rows || [];
        }

        if (data.length < 2 && state) {
          const { data: stateRows } = await supabase
            .from('local_announcements')
            .select('*, member:members(first_name,last_name,party:parties(colour,short_name))')
            .eq('state', state)
            .is('electorate_id', null)
            .not('source_url', 'is', null)
            .order('announced_at', { ascending: false })
            .limit(6);
          data = [...data, ...(stateRows || [])].slice(0, 6);
        }

        if (!cancelled) setAnnouncements(data);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    };

    run();
    return () => { cancelled = true; };
  }, [electorateId, state]);

  return { announcements, loading };
}


/**
 * Full-list variant for the dedicated LocalAnnouncementsScreen.
 * Returns up to 50 announcements for one electorate, ordered by announced_at DESC.
 * No state fallback — the screen is explicitly "announcements for your electorate".
 */
export function useElectorateAnnouncements(electorateId: string | undefined | null) {
  const [announcements, setAnnouncements] = useState<LocalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electorateId) { setLoading(false); setAnnouncements([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('local_announcements')
          .select('*, member:members(first_name,last_name,party:parties(colour,short_name))')
          .eq('electorate_id', electorateId)
          .not('source_url', 'is', null)
          .order('announced_at', { ascending: false })
          .limit(50);
        if (!cancelled) setAnnouncements((data as LocalAnnouncement[]) || []);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [electorateId]);

  return { announcements, loading };
}
