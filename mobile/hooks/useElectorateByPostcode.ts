import { useState, useEffect } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Member } from './useMembers';

const MP_CACHE_KEY = 'cached_mp_data';
const MP_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface ElectorateResult {
  electorate: { id: string; name: string; state: string } | null;
  member: Member | null;
}

export function useElectorateByPostcode(postcode: string | null) {
  const [result, setResult] = useState<ElectorateResult>({ electorate: null, member: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postcode || postcode.length < 4) { setResult({ electorate: null, member: null }); return; }
    setLoading(true);

    const fetch = async () => {
      // ── Try cache first (MP data rarely changes) ───────────────────
      try {
        const cached = await AsyncStorage.getItem(MP_CACHE_KEY);
        if (cached) {
          const { postcode: cachedPC, data, timestamp } = JSON.parse(cached);
          if (cachedPC === postcode && Date.now() - timestamp < MP_CACHE_TTL) {
            setResult(data);
            setLoading(false);
            // Still fetch in background to refresh silently
          }
        }
      } catch {}

      // ── Fetch from Supabase ────────────────────────────────────────
      try {
        const { data: electorates } = await supabase
          .from('electorates')
          .select('id,name,state')
          .contains('postcodes', [postcode])
          .eq('level', 'federal')
          .limit(1);

        const electorate = electorates?.[0] || null;
        let member = null;

        if (electorate) {
          const { data: members } = await supabase
            .from('members')
            .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
            .eq('electorate_id', electorate.id)
            .eq('chamber', 'house')
            .eq('is_active', true)
            .limit(1);
          member = members?.[0] || null;
        }

        const freshResult = { electorate, member };
        setResult(freshResult);
        // Cache for offline / instant next load
        AsyncStorage.setItem(MP_CACHE_KEY, JSON.stringify({ postcode, data: freshResult, timestamp: Date.now() })).catch(() => {});
      } catch {
        // Network failure — cached result (if any) stays
      }
      setLoading(false);
    };

    fetch();
  }, [postcode]);

  return { ...result, loading };
}
