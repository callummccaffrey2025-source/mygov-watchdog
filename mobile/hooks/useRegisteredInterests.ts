import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RegisteredInterest {
  id: string;
  category: string;
  description: string;
  date_registered: string | null;
  source_url: string | null;
}

export function useRegisteredInterests(memberId: string | undefined) {
  const [interests, setInterests] = useState<RegisteredInterest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('registered_interests')
          .select('id,category,description,date_registered,source_url')
          .eq('member_id', memberId)
          .order('category');
        if (!cancelled) {
          setInterests((data || []) as RegisteredInterest[]);
        }
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  // Group by category
  const grouped = interests.reduce<Record<string, RegisteredInterest[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return { interests, grouped, loading };
}
