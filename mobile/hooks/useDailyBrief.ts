import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Bill } from './useBills';

const BRIEF_CACHE_KEY = 'cached_daily_brief';
const BRIEF_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export interface AiBriefText {
  what_happened: string[];
  what_it_means: string;
  one_thing_to_know: string;
}

export interface DailyStory {
  headline: string;
  summary: string;
  category: string;
  source_url: string | null;
  bill_id: string | null;
}

export interface NationalUpdate {
  text: string;
  category: string;
}

export interface DailyBriefData {
  id: string;
  date: string;
  electorate: string;
  stories: DailyStory[];
  bills_to_watch: string[];
  national_updates: NationalUpdate[];
  ai_text: AiBriefText | null;
  is_personalised: boolean;
  created_at: string;
}

async function loadBills(billIds: string[]): Promise<Bill[]> {
  if (!billIds || !billIds.length) return [];
  const { data } = await supabase
    .from('bills')
    .select('id,title,short_title,current_status,status,summary_plain,summary_full,categories,date_introduced,last_updated,chamber_introduced,origin_chamber,level,aph_url')
    .in('id', billIds);
  return (data || []) as Bill[];
}

export function useDailyBrief(electorate: string | null = null, mpName: string | null = null) {
  const [brief, setBrief] = useState<DailyBriefData | null>(null);
  const [billsToWatch, setBillsToWatch] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async (cancelled = false) => {
    setLoading(true);

    // ── Load cached brief instantly (offline-first) ──────────────────
    try {
      const cached = await AsyncStorage.getItem(BRIEF_CACHE_KEY);
      if (cached && !cancelled) {
        const { brief: cachedBrief, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < BRIEF_CACHE_TTL) {
          setBrief(cachedBrief as DailyBriefData);
          // Don't stop loading — still fetch fresh data below
        }
      }
    } catch {}

    const todayAEST = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);

    // ── 1. Load national brief immediately (fast path) ────────────────
    const { data: national } = await supabase
      .from('daily_briefs')
      .select('*')
      .eq('date', todayAEST)
      .eq('electorate', '__national__')
      .maybeSingle();

    let baseData: DailyBriefData | null = national as DailyBriefData | null;

    if (!baseData) {
      // Fall back to most recent brief of any kind
      const { data: fallback } = await supabase
        .from('daily_briefs')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      baseData = fallback as DailyBriefData | null;
    }

    if (baseData && !cancelled) {
      setBrief(baseData);
      const bills = await loadBills(baseData.bills_to_watch ?? []);
      if (!cancelled) setBillsToWatch(bills);
      // Cache for offline use
      AsyncStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify({ brief: baseData, timestamp: Date.now() })).catch(() => {});
    }
    if (!cancelled) setLoading(false);

    // ── 2. Try personalised brief if electorate is known ──────────────
    if (!electorate || cancelled) return;

    const { data: electorateBrief } = await supabase
      .from('daily_briefs')
      .select('*')
      .eq('date', todayAEST)
      .eq('electorate', electorate)
      .maybeSingle();

    if (electorateBrief && !cancelled) {
      setBrief(electorateBrief as DailyBriefData);
      const bills = await loadBills(electorateBrief.bills_to_watch ?? []);
      if (!cancelled) setBillsToWatch(bills);
      AsyncStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify({ brief: electorateBrief, timestamp: Date.now() })).catch(() => {});
      return;
    }

    // ── 3. Generate on-demand (2-3s, national brief shown while waiting) ──
    if (!cancelled) setGenerating(true);
    try {
      const { data: genData, error } = await supabase.functions.invoke('generate-daily-brief', {
        body: { electorate, mp_name: mpName },
      });
      if (!cancelled && genData && !error) {
        setBrief(genData as DailyBriefData);
        const bills = await loadBills(genData.bills_to_watch ?? []);
        if (!cancelled) setBillsToWatch(bills);
      }
    } catch {
      // Keep national brief
    }
    if (!cancelled) setGenerating(false);
  }, [electorate, mpName]);

  useEffect(() => {
    let cancelled = false;
    refresh(cancelled);
    return () => { cancelled = true; };
  }, [refresh]);

  return { brief, billsToWatch, loading, generating, refresh: () => refresh() };
}
