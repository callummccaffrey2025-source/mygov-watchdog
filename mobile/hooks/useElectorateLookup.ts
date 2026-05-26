import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '../lib/storage';
import postcodeData from '../assets/postcode_to_electorate.json';

const POSTCODE_MAP = postcodeData as Record<string, string | string[]>;

export interface Representative {
  id: string;
  first_name: string;
  last_name: string;
  chamber: string;
  photo_url: string | null;
  party_name: string;
  party_short: string;
  party_colour: string;
  electorate_name: string;
  state: string;
}

export interface LookupResult {
  electorates: string[];
  selectedElectorate: string | null;
  houseMP: Representative | null;
  senators: Representative[];
  state: string | null;
}

export function useElectorateLookup() {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (postcode: string) => {
    setLoading(true);
    setError(null);

    const clean = postcode.trim();
    if (!/^\d{4}$/.test(clean)) {
      setError('Enter a valid 4-digit Australian postcode');
      setLoading(false);
      return;
    }

    const electorates = POSTCODE_MAP[clean];
    if (!electorates) {
      setError('No electorate found for this postcode');
      setLoading(false);
      return;
    }

    const electorateList = Array.isArray(electorates) ? electorates : [electorates];

    setResult({
      electorates: electorateList,
      selectedElectorate: electorateList.length === 1 ? electorateList[0] : null,
      houseMP: null,
      senators: [],
      state: null,
    });

    if (electorateList.length === 1) {
      await selectElectorate(electorateList[0]);
    }

    setLoading(false);
  }, []);

  const selectElectorate = useCallback(async (electorateName: string) => {
    setLoading(true);
    try {
      // Find electorate
      const { data: electorate } = await supabase
        .from('electorates')
        .select('id, name, state')
        .eq('name', electorateName)
        .maybeSingle();

      if (!electorate) {
        setError(`Electorate "${electorateName}" not found`);
        setLoading(false);
        return;
      }

      // Find House MP for this electorate
      const { data: houseMembers } = await supabase
        .from('members')
        .select('id, first_name, last_name, chamber, photo_url, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates(name, state)')
        .eq('electorate_id', electorate.id)
        .eq('chamber', 'house')
        .eq('is_active', true)
        .limit(1);

      // Find Senators for this state
      const { data: senateMembers } = await supabase
        .from('members')
        .select('id, first_name, last_name, chamber, photo_url, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates(name, state)')
        .eq('chamber', 'senate')
        .eq('is_active', true);

      // Filter senators by state
      const stateSenators = (senateMembers || []).filter(
        (s: any) => s.electorate?.state === electorate.state || s.electorate?.name === electorate.state
      );

      const mapMember = (m: any): Representative => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        chamber: m.chamber,
        photo_url: m.photo_url && m.photo_url !== 'NA' ? m.photo_url : null,
        party_name: m.party?.name || 'Independent',
        party_short: m.party?.short_name || '',
        party_colour: m.party?.colour || '#6B7280',
        electorate_name: m.electorate?.name || '',
        state: m.electorate?.state || electorate.state,
      });

      const houseMP = houseMembers && houseMembers.length > 0 ? mapMember(houseMembers[0]) : null;

      setResult({
        electorates: [electorateName],
        selectedElectorate: electorateName,
        houseMP,
        senators: stateSenators.map(mapMember),
        state: electorate.state,
      });

      // Cache electorate to device for personalisation
      await AsyncStorage.setItem('user_electorate', electorateName);
      await AsyncStorage.setItem('user_electorate_id', electorate.id);
      await AsyncStorage.setItem('user_state', electorate.state);
    } catch {
      setError('Failed to look up representatives');
    }
    setLoading(false);
  }, []);

  return { result, loading, error, lookup, selectElectorate };
}
