import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
const SIGNAL_CACHE_KEY = 'cached_morning_signal';
const SIGNAL_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface MorningSignalStory {
  story_id: number;
  headline: string;
  why_it_matters: string;
  source_ids: string[];
}

export interface ShiftedPosition {
  member_id: string;
  member_name: string;
  old_position: string;
  new_position: string;
  evidence_id: string;
}

export interface BillMovement {
  bill_id: string;
  bill_title: string;
  from_stage: string;
  to_stage: string;
}

export interface Blindspot {
  topic: string;
  gap_side: 'left' | 'right';
  story_ids: number[];
}

export interface MorningSignalData {
  id: string;
  date: string;
  electorate: string;
  top_stories: MorningSignalStory[];
  shifted_positions: ShiftedPosition[] | null;
  bill_movements: BillMovement[] | null;
  blindspot: Blindspot | null;
  electorate_impact: string | null;
  created_at: string;
}

export function useMorningSignal(electorate: string | null = null, mpName: string | null = null) {
  const [signal, setSignal] = useState<MorningSignalData | null>(null);
  const [loading, setLoading] = useState(true);

  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);

    // ── Load cached signal instantly (offline-first) ────────────────────
    try {
      const cached = await AsyncStorage.getItem(SIGNAL_CACHE_KEY);
      if (cached && !cancelledRef.current) {
        const { signal: cachedSignal, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < SIGNAL_CACHE_TTL) {
          setSignal(cachedSignal as MorningSignalData);
        }
      }
    } catch {}

    const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);

    // ── 1. Load national signal immediately (fast path) ────────────────
    const { data: national } = await supabase
      .from('morning_signals')
      .select('*')
      .eq('date', todayAEST)
      .eq('electorate', '__national__')
      .maybeSingle();

    let baseData: MorningSignalData | null = national as MorningSignalData | null;

    if (!baseData) {
      // Fall back to most recent signal of any kind
      const { data: fallback } = await supabase
        .from('morning_signals')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      baseData = fallback as MorningSignalData | null;
    }

    if (baseData && !cancelledRef.current) {
      setSignal(baseData);
      AsyncStorage.setItem(
        SIGNAL_CACHE_KEY,
        JSON.stringify({ signal: baseData, timestamp: Date.now() }),
      ).catch(() => {});
    }
    if (!cancelledRef.current) setLoading(false);

    // ── 2. Try electorate-specific signal if electorate is known ────────
    if (!electorate || cancelledRef.current) return;

    const { data: electorateSignal } = await supabase
      .from('morning_signals')
      .select('*')
      .eq('date', todayAEST)
      .eq('electorate', electorate)
      .maybeSingle();

    if (electorateSignal && !cancelledRef.current) {
      setSignal(electorateSignal as MorningSignalData);
      AsyncStorage.setItem(
        SIGNAL_CACHE_KEY,
        JSON.stringify({ signal: electorateSignal, timestamp: Date.now() }),
      ).catch(() => {});
      return;
    }

    // ── 3. Generate on-demand (national signal shown while waiting) ─────
    try {
      const { data: genData, error } = await supabase.functions.invoke('generate-morning-signal', {
        body: { electorate, mp_name: mpName },
      });
      if (!cancelledRef.current && genData && !error) {
        setSignal(genData as MorningSignalData);
        AsyncStorage.setItem(
          SIGNAL_CACHE_KEY,
          JSON.stringify({ signal: genData, timestamp: Date.now() }),
        ).catch(() => {});
      }
    } catch {
      // Keep national signal or cached data
    }
  }, [electorate, mpName]);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();
    return () => { cancelledRef.current = true; };
  }, [refresh]);

  return { signal, loading, refresh: () => refresh() };
}
