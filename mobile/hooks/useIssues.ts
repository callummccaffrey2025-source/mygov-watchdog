import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Issue {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  display_order: number;
}

/**
 * Fetches the active issues master list for selection UIs (onboarding, settings).
 * Issues are ordered by display_order for consistent rendering.
 */
export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('issues')
          .select('*')
          .eq('is_active', true)
          .order('display_order');

        if (!cancelled) setIssues((data as Issue[]) || []);
      } catch {
        // Non-critical — show empty list
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { issues, loading };
}
