import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SittingDay {
  id: string;
  date: string;
  chamber: string;
  is_sitting: boolean;
  description: string | null;
}

export function useSittingCalendar() {
  const [isSittingToday, setIsSittingToday] = useState(false);
  const [todayInfo, setTodayInfo] = useState<SittingDay | null>(null);
  const [nextSitting, setNextSitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const { data: todayData } = await supabase
          .from('sitting_calendar')
          .select('*')
          .eq('date', today)
          .eq('is_sitting', true)
          .limit(1);

        if (cancelled) return;

        if (todayData && todayData.length > 0) {
          setIsSittingToday(true);
          setTodayInfo(todayData[0] as SittingDay);
        } else {
          const { data: nextData } = await supabase
            .from('sitting_calendar')
            .select('date')
            .gt('date', today)
            .eq('is_sitting', true)
            .order('date', { ascending: true })
            .limit(1);

          if (!cancelled && nextData?.[0]) {
            setNextSitting(nextData[0].date);
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { isSittingToday, todayInfo, nextSitting, loading };
}
