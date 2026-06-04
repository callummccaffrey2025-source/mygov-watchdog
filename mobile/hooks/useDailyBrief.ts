import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '../lib/storage';

export interface MPWeek {
  mp_name: string;
  mp_party: string;
  mp_photo: string | null;
  electorate: string;
  votes: Array<{ division_name: string; vote: string; date: string }>;
  rebellions: number;
  speeches: number;
  summary: string;
}

export interface ElectorateNews {
  local_stories: Array<{ title: string; source: string }>;
  context: string | null;
  margin: string | null;
  holding_party: string | null;
}

export interface BriefBill {
  id: string;
  title: string;
  status: string;
  mp_voted: string | null;
}

export interface PollSnapshot {
  alp: number | null;
  lnp: number | null;
  onp: number | null;
  grn: number | null;
  days_to_election: number;
}

export interface DailyBriefData {
  date: string;
  mp: MPWeek | null;
  electorate: ElectorateNews | null;
  bills: BriefBill[];
  polls: PollSnapshot | null;
  one_thing: string | null;
  // AI-generated brief from daily_briefs table (fallback/supplement)
  ai_text: any | null;
}

export function useDailyBrief() {
  const [brief, setBrief] = useState<DailyBriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const electorateId = await AsyncStorage.getItem('user_electorate_id');
        const electorateName = await AsyncStorage.getItem('user_electorate');

        // Fetch user's MP
        let memberId: string | null = null;
        let memberData: any = null;

        if (electorateId) {
          const { data: mp } = await supabase
            .from('members')
            .select('id, first_name, last_name, photo_url, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates!members_electorate_id_fkey(name, state, margin_percent, holding_party)')
            .eq('electorate_id', electorateId)
            .eq('chamber', 'house')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (mp) {
            memberId = mp.id;
            memberData = mp;
          }
        }

        // Parallel fetches
        const [votesRes, speechesRes, pollRes, billsRes, localNewsRes, aiBriefRes] = await Promise.all([
          // MP's recent votes (last 7 days)
          memberId
            ? supabase.from('division_votes')
                .select('vote_cast, rebelled, divisions(name, date)')
                .eq('member_id', memberId)
                .order('created_at', { ascending: false })
                .limit(10)
            : Promise.resolve({ data: null }),

          // MP's recent speeches
          memberId
            ? supabase.from('hansard_entries')
                .select('id', { count: 'exact', head: true })
                .eq('member_id', memberId)
            : Promise.resolve({ data: null, count: 0 }),

          // Latest poll aggregate
          supabase.from('poll_aggregates')
            .select('primary_alp, primary_lnp, primary_grn, primary_onp')
            .eq('scope', 'federal')
            .eq('window_days', 30)
            .order('as_of_date', { ascending: false })
            .limit(1)
            .maybeSingle(),

          // Active bills
          supabase.from('bills')
            .select('id, title, short_title, current_status')
            .in('current_status', ['introduced', 'passed_house'])
            .order('last_updated', { ascending: false })
            .limit(5),

          // Local news
          electorateId
            ? supabase.from('news_articles')
                .select('title, source_name')
                .eq('electorate_id', electorateId)
                .eq('is_local', true)
                .order('created_at', { ascending: false })
                .limit(3)
            : Promise.resolve({ data: null }),

          // AI-generated brief (if exists)
          supabase.from('daily_briefs')
            .select('ai_text, date')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        // Build MP week
        const votes = (votesRes.data || []).map((v: any) => ({
          division_name: v.divisions?.name?.replace(/^[A-Za-z\s]+\s*[—–-]\s*/i, '').trim() || 'Division',
          vote: v.vote_cast,
          date: v.divisions?.date || '',
        }));

        const rebellions = (votesRes.data || []).filter((v: any) => v.rebelled).length;
        const aye = votes.filter((v: any) => v.vote === 'aye').length;

        let mpWeek: MPWeek | null = null;
        if (memberData) {
          const partyShort = memberData.party?.short_name || memberData.party?.name || '';
          mpWeek = {
            mp_name: `${memberData.first_name} ${memberData.last_name}`,
            mp_party: partyShort,
            mp_photo: memberData.photo_url && memberData.photo_url !== 'NA' ? memberData.photo_url : null,
            electorate: memberData.electorate?.name || electorateName || '',
            votes,
            rebellions,
            speeches: (speechesRes as any)?.count || 0,
            summary: votes.length > 0
              ? `${memberData.first_name} voted ${votes.length} time${votes.length !== 1 ? 's' : ''} recently${rebellions > 0 ? `, crossing the floor ${rebellions} time${rebellions !== 1 ? 's' : ''}` : `, all with the ${partyShort} majority`}.`
              : `No recent votes recorded for ${memberData.first_name}.`,
          };
        }

        // Build electorate
        let electorateData: ElectorateNews | null = null;
        if (memberData?.electorate || localNewsRes.data) {
          electorateData = {
            local_stories: (localNewsRes.data || []).map((n: any) => ({
              title: n.title,
              source: n.source_name || '',
            })),
            context: null,
            margin: memberData?.electorate?.margin_percent
              ? `${memberData.electorate.margin_percent}%`
              : null,
            holding_party: memberData?.electorate?.holding_party || null,
          };
        }

        // Build polls
        const pollData = pollRes.data;
        const electionDate = new Date('2028-05-20');
        const daysToElection = Math.max(0, Math.ceil((electionDate.getTime() - Date.now()) / 86400000));

        const polls: PollSnapshot | null = pollData ? {
          alp: pollData.primary_alp,
          lnp: pollData.primary_lnp,
          onp: pollData.primary_onp,
          grn: pollData.primary_grn,
          days_to_election: daysToElection,
        } : null;

        // Build bills
        const bills: BriefBill[] = (billsRes.data || []).map((b: any) => ({
          id: b.id,
          title: b.short_title || b.title,
          status: b.current_status,
          mp_voted: null, // Would need division_votes join per bill
        }));

        // One thing to know (from AI brief or generate from data)
        const oneThing = aiBriefRes.data?.ai_text?.one_thing_to_know || null;

        setBrief({
          date: new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          mp: mpWeek,
          electorate: electorateData,
          bills,
          polls,
          one_thing: oneThing,
          ai_text: aiBriefRes.data?.ai_text || null,
        });
      } catch {
        // non-critical
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { brief, loading };
}
