import { useState, useEffect } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Member } from './useMembers';

// Local postcode→electorate mapping (pmcau/AustralianElectorates, 2,502 postcodes)
import postcodeMap from '../assets/postcode_to_electorate.json';

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
          }
        }
      } catch {}

      // ── Resolve electorate name locally first (instant, offline) ───
      const localElectorates = (postcodeMap as Record<string, string[]>)[postcode];
      const localElectorateName = localElectorates?.[0] ?? null;

      // ── Fetch from Supabase ────────────────────────────────────────
      try {
        let electorate = null;

        if (localElectorateName) {
          // Fast path: look up by name directly (avoids array contains scan)
          const { data: electorates } = await supabase
            .from('electorates')
            .select('id,name,state')
            .ilike('name', localElectorateName)
            .eq('level', 'federal')
            .limit(1);
          electorate = electorates?.[0] || null;
        }

        if (!electorate) {
          // Fallback: original array contains query
          const { data: electorates } = await supabase
            .from('electorates')
            .select('id,name,state')
            .contains('postcodes', [postcode])
            .eq('level', 'federal')
            .limit(1);
          electorate = electorates?.[0] || null;
        }

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
