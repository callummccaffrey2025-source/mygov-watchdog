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
    supabase
      .from('parties')
      .select('*')
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setParties(data || []);
        setLoading(false);
      });
  }, []);

  return { parties, loading, error };
}
