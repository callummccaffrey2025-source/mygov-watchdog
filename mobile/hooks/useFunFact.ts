import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface FunFact {
  id: number;
  fact: string;
  category: string;
  source: string;
}

export function useFunFact() {
  const [fact, setFact] = useState<FunFact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('fun_facts')
      .select('id,fact,category,source')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const now = new Date();
          const startOfYear = new Date(now.getFullYear(), 0, 0);
          const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
          const index = dayOfYear % data.length;
          setFact(data[index] as FunFact);
        }
        setLoading(false);
      });
  }, []);

  return { fact, loading };
}
