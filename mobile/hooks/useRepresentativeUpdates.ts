import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RepresentativeUpdate {
  id: number;
  content: string;
  source: string;
  source_url: string | null;
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

export function useRepresentativeUpdates() {
  const [updates, setUpdates] = useState<RepresentativeUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        setUpdates((data as unknown as RepresentativeUpdate[]) || []);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  return { updates, loading };
}
