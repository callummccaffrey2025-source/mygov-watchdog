import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface SwipeBill {
  id: string;
  title: string;
  short_title: string | null;
  tldr: string | null;
  summary_plain: string | null;
  supporters_argument: string | null;
  critics_argument: string | null;
  current_status: string | null;
  origin_chamber: string | null;
  date_introduced: string | null;
  agree_count: number;
  disagree_count: number;
}

export function useBillSwipe() {
  const { user } = useUser();
  const [bills, setBills] = useState<SwipeBill[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Get bills with explainers that are currently before parliament
        const { data } = await supabase
          .from('bills')
          .select('id, title, short_title, tldr, summary_plain, supporters_argument, critics_argument, current_status, origin_chamber, date_introduced')
          .eq('current_status', 'Before Parliament')
          .eq('parliament_no', 48)
          .not('tldr', 'is', null)
          .order('date_introduced', { ascending: false })
          .limit(20);

        if (cancelled || !data) return;

        // Get user's existing opinions to filter out already-swiped
        const seenKey = `bill_opinions_seen_${user?.id ?? 'anon'}`;
        const seenRaw = await AsyncStorage.getItem(seenKey);
        const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

        // Get aggregate opinion counts
        const billIds = data.map(b => b.id);
        const { data: opinionCounts } = await supabase
          .from('bill_opinions')
          .select('bill_id, opinion')
          .in('bill_id', billIds);

        const counts: Record<string, { agree: number; disagree: number }> = {};
        for (const o of (opinionCounts ?? [])) {
          if (!counts[o.bill_id]) counts[o.bill_id] = { agree: 0, disagree: 0 };
          if (o.opinion === 'agree') counts[o.bill_id].agree++;
          if (o.opinion === 'disagree') counts[o.bill_id].disagree++;
        }

        const unseen = data
          .filter(b => !seen.has(b.id))
          .map(b => ({
            ...b,
            agree_count: counts[b.id]?.agree ?? 0,
            disagree_count: counts[b.id]?.disagree ?? 0,
          }));

        if (!cancelled) {
          setBills(unseen as SwipeBill[]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const currentBill = bills[currentIndex] ?? null;
  const remaining = bills.length - currentIndex;

  const submitOpinion = useCallback(async (opinion: 'agree' | 'disagree' | 'skip') => {
    if (!currentBill) return;

    // Mark as seen locally
    const seenKey = `bill_opinions_seen_${user?.id ?? 'anon'}`;
    const seenRaw = await AsyncStorage.getItem(seenKey);
    const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
    seen.push(currentBill.id);
    await AsyncStorage.setItem(seenKey, JSON.stringify(seen));

    // Submit to DB (fire and forget)
    if (opinion !== 'skip') {
      const deviceId = await AsyncStorage.getItem('device_id');
      Promise.resolve(
        supabase.from('bill_opinions').insert({
          bill_id: currentBill.id,
          user_id: user?.id ?? null,
          device_id: deviceId,
          opinion,
        })
      ).catch(() => {});
    }

    // Advance to next bill
    setCurrentIndex(i => i + 1);
  }, [currentBill, user?.id]);

  return { currentBill, remaining, loading, submitOpinion };
}
