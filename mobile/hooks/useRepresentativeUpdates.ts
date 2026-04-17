import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RepresentativeUpdate {
  id: number;
  content: string;
  source: string;
  // DB enforces NOT NULL via the migration_mp_statements.sql constraint.
  // Legacy pre-constraint rows are filtered out below.
  source_url: string;
  published_at: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
    party: {
      name: string;
      short_name: string | null;
      colour: string | null;
    } | null;
  } | null;
}

/** Per-member statement shape for MemberProfileScreen Statements tab. */
export interface MemberStatement {
  id: number;
  content: string;
  source: string;
  source_url: string;
  published_at: string;
}

export function useRepresentativeUpdates() {
  const [updates, setUpdates] = useState<RepresentativeUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('representative_updates')
          .select(
            'id, content, source, source_url, published_at, member:members(id, first_name, last_name, photo_url, party:parties(name, short_name, colour))'
          )
          .not('source_url', 'is', null)
          .order('published_at', { ascending: false })
          .limit(10);
        if (!cancelled) setUpdates((data as unknown as RepresentativeUpdate[]) || []);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { updates, loading };
}

/**
 * Statements for a single MP — populated by scripts/ingest_mp_statements.py.
 * Every row returned has a non-null source_url because:
 *   1. The DB NOT NULL constraint blocks inserts without one, and
 *   2. The .not('source_url', 'is', null) filter catches any legacy rows.
 */
export function useMemberStatements(memberId: string | undefined | null) {
  const [statements, setStatements] = useState<MemberStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); setStatements([]); return; }
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('representative_updates')
          .select('id, content, source, source_url, published_at')
          .eq('member_id', memberId)
          .not('source_url', 'is', null)
          .order('published_at', { ascending: false })
          .limit(30);
        if (!cancelled) setStatements((data as unknown as MemberStatement[]) || []);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, [memberId]);

  return { statements, loading };
}
