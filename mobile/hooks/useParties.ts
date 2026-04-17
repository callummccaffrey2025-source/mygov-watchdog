import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Party {
  id: string;
  name: string;
  abbreviation: string | null;
  short_name: string | null;
  colour: string | null;
  level: string | null;
}

export function useParties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('parties')
          .select('*')
          .order('name');
        if (cancelled) return;
        if (err) setError(err.message);
        else setParties(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Network error');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { parties, loading, error };
}
