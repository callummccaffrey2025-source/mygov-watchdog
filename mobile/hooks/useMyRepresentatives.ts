import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Member } from './useMembers';
import { StateMember } from './useStateParliament';
import { Council } from './useCouncils';
import postcodeMap from '../assets/postcode_to_electorate.json';

export interface RepresentativeGroup {
  level: 'federal' | 'state' | 'local';
  label: string;
  representatives: Representative[];
}

export interface Representative {
  id: string;
  name: string;
  role: string;
  party: string;
  partyColor: string;
  photoUrl: string | null;
  level: 'federal' | 'state' | 'local';
  chamber?: string;
  electorate?: string;
  email?: string | null;
  // Navigation target
  navScreen: string;
  navParams: Record<string, any>;
}

export function useMyRepresentatives(postcode: string | null) {
  const [groups, setGroups] = useState<RepresentativeGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postcode || postcode.length < 4) { setGroups([]); return; }
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const federalReps: Representative[] = [];
        const stateReps: Representative[] = [];
        const localReps: Representative[] = [];

        // ── Federal: House MP ──
        const localElectorates = (postcodeMap as Record<string, string[]>)[postcode];
        const localElectorateName = localElectorates?.[0] ?? null;

        let federalElectorate = null;
        if (localElectorateName) {
          const { data } = await supabase
            .from('electorates')
            .select('id,name,state')
            .ilike('name', localElectorateName)
            .eq('level', 'federal')
            .limit(1);
          federalElectorate = data?.[0] || null;
        }

        if (federalElectorate) {
          // House member
          const { data: houseMembers } = await supabase
            .from('members')
            .select('*, party:parties!members_party_id_fkey(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
            .eq('electorate_id', federalElectorate.id)
            .eq('chamber', 'house')
            .eq('is_active', true)
            .limit(1);

          const houseMember = houseMembers?.[0];
          if (houseMember) {
            federalReps.push({
              id: houseMember.id,
              name: `${houseMember.first_name} ${houseMember.last_name}`,
              role: `MP for ${houseMember.electorate?.name || ''}`,
              party: houseMember.party?.short_name || houseMember.party?.name || '',
              partyColor: houseMember.party?.colour || '#6B7280',
              photoUrl: houseMember.photo_url,
              level: 'federal',
              chamber: 'house',
              electorate: houseMember.electorate?.name,
              email: houseMember.email,
              navScreen: 'MemberProfile',
              navParams: { member: houseMember },
            });
          }

          // Senators for the state
          const state = federalElectorate.state;
          if (state) {
            const { data: senators } = await supabase
              .from('members')
              .select('*, party:parties!members_party_id_fkey(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
              .eq('chamber', 'senate')
              .eq('is_active', true)
              .ilike('electorate.state', state);

            (senators || []).forEach((s: any) => {
              if (s.electorate?.state?.toUpperCase() === state.toUpperCase()) {
                federalReps.push({
                  id: s.id,
                  name: `${s.first_name} ${s.last_name}`,
                  role: `Senator for ${s.electorate?.state || ''}`,
                  party: s.party?.short_name || s.party?.name || '',
                  partyColor: s.party?.colour || '#6B7280',
                  photoUrl: s.photo_url,
                  level: 'federal',
                  chamber: 'senate',
                  electorate: s.electorate?.state,
                  email: s.email,
                  navScreen: 'MemberProfile',
                  navParams: { member: s },
                });
              }
            });
          }

          // ── State: look up state members by electorate name match ──
          if (state) {
            const { data: stateMembers } = await supabase
              .from('state_members')
              .select('*')
              .eq('state', state)
              .limit(50);

            // We can't precisely map postcode to state electorate without state electorate boundaries,
            // but we show all state members for the state so users can find theirs
            // For now, show first 5 as a sample with a "See all" affordance
            (stateMembers || []).slice(0, 5).forEach((sm: any) => {
              stateReps.push({
                id: sm.id,
                name: sm.name || `${sm.first_name || ''} ${sm.last_name || ''}`.trim(),
                role: sm.role || `${sm.chamber === 'lower' ? 'MLA' : 'MLC'} for ${sm.electorate || ''}`,
                party: sm.party || '',
                partyColor: '#6B7280',
                photoUrl: sm.photo_url,
                level: 'state',
                chamber: sm.chamber,
                electorate: sm.electorate,
                navScreen: '', // State members don't have a profile screen yet
                navParams: {},
              });
            });
          }

          // ── Local: council by postcode ──
          const { data: councils } = await supabase
            .from('councils')
            .select('id,name,state,type,mayor_name,area_postcodes,phone,email')
            .contains('area_postcodes', [postcode]);

          (councils || []).forEach((c: any) => {
            localReps.push({
              id: c.id,
              name: c.name,
              role: c.mayor_name ? `Mayor: ${c.mayor_name}` : 'Local Council',
              party: '',
              partyColor: '#6B7280',
              photoUrl: null,
              level: 'local',
              email: c.email,
              navScreen: 'Council',
              navParams: { councilId: c.id },
            });
          });
        }

        if (cancelled) return;

        const result: RepresentativeGroup[] = [];
        if (federalReps.length > 0) {
          result.push({ level: 'federal', label: 'Federal Parliament', representatives: federalReps });
        }
        if (stateReps.length > 0) {
          result.push({ level: 'state', label: 'State Parliament', representatives: stateReps });
        }
        if (localReps.length > 0) {
          result.push({ level: 'local', label: 'Local Council', representatives: localReps });
        }

        setGroups(result);
      } catch {
        // non-critical
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [postcode]);

  return { groups, loading };
}
