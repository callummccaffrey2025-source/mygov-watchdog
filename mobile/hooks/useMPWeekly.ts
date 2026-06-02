import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WeeklyVote {
  division_id: string;
  division_name: string;
  date: string;
  vote_cast: string;
  aye_votes: number;
  no_votes: number;
  issue_name: string | null;
  aye_supports: boolean | null;
  /** 'support' | 'oppose' | null — what the vote means relative to the issue */
  vote_signal: 'support' | 'oppose' | null;
  source_url: string | null;
}

export interface MPWeeklySummary {
  member_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  party_name: string;
  party_short: string | null;
  party_colour: string | null;
  electorate: string;
  total_votes: number;
  votes: WeeklyVote[];
  /** Sitting days the MP voted on */
  sitting_days: number;
  /** Week label e.g. "25 Mar – 1 Apr 2026" */
  week_label: string;
  /** Most recent sitting date with votes */
  latest_date: string | null;
}

function weekLabel(dates: string[]): string {
  if (dates.length === 0) return 'No votes this week';
  const sorted = [...dates].sort();
  const first = new Date(sorted[0] + 'T00:00:00');
  const last = new Date(sorted[sorted.length - 1] + 'T00:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  const year = last.getFullYear();
  return `${fmt(first)} – ${fmt(last)} ${year}`;
}

export function useMPWeekly(memberId: string | null) {
  const [summary, setSummary] = useState<MPWeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Get member info
        const { data: member } = await supabase
          .from('members')
          .select('id, first_name, last_name, photo_url, party:parties!members_party_id_fkey(name, short_name, colour), electorate:electorates!members_electorate_id_fkey(name)')
          .eq('id', memberId)
          .single();

        if (!member || cancelled) { setLoading(false); return; }

        // Find the most recent sitting week (last date with votes, then 7 days back)
        const { data: latestVote } = await supabase
          .from('division_votes')
          .select('division:divisions!inner(date)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestDate = (latestVote?.[0] as any)?.division?.date;
        if (!latestDate || cancelled) {
          const party = Array.isArray(member.party) ? member.party[0] : member.party;
          const electorate = Array.isArray(member.electorate) ? member.electorate[0] : member.electorate;
          setSummary({
            member_id: memberId,
            first_name: member.first_name,
            last_name: member.last_name,
            photo_url: member.photo_url,
            party_name: party?.name ?? 'Unknown',
            party_short: party?.short_name ?? null,
            party_colour: party?.colour ?? null,
            electorate: electorate?.name ?? '',
            total_votes: 0,
            votes: [],
            sitting_days: 0,
            week_label: 'No voting activity yet',
            latest_date: null,
          });
          setLoading(false);
          return;
        }

        // Go back 7 days from the latest vote date
        const endDate = new Date(latestDate + 'T00:00:00');
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        const startStr = startDate.toISOString().slice(0, 10);

        // Fetch all votes in that window
        const { data: voteRows } = await supabase
          .from('division_votes')
          .select('vote_cast, division:divisions!inner(id, name, date, aye_votes, no_votes, source_url)')
          .eq('member_id', memberId)
          .gte('division.date', startStr)
          .lte('division.date', latestDate)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        // Get issue tags for these divisions
        const divIds = (voteRows ?? []).map((v: any) => v.division?.id).filter(Boolean);
        let tagMap = new Map<string, { issue_name: string; aye_supports: boolean }>();

        if (divIds.length > 0) {
          const { data: tags } = await supabase
            .from('division_issue_tags')
            .select('division_id, aye_supports, policy_issues(name)')
            .in('division_id', divIds)
            .gte('confidence', 0.6);

          for (const tag of (tags ?? []) as any[]) {
            const pi = Array.isArray(tag.policy_issues) ? tag.policy_issues[0] : tag.policy_issues;
            if (pi?.name) {
              tagMap.set(tag.division_id, { issue_name: pi.name, aye_supports: tag.aye_supports });
            }
          }
        }

        // Build vote list (deduplicate by division_id)
        const seen = new Set<string>();
        const votes: WeeklyVote[] = [];
        const dateSet = new Set<string>();

        for (const row of (voteRows ?? []) as any[]) {
          const div = Array.isArray(row.division) ? row.division[0] : row.division;
          if (!div?.id || seen.has(div.id)) continue;
          seen.add(div.id);
          dateSet.add(div.date);

          const tag = tagMap.get(div.id);
          let voteSignal: 'support' | 'oppose' | null = null;
          if (tag) {
            const isAye = row.vote_cast === 'aye';
            voteSignal = (isAye === tag.aye_supports) ? 'support' : 'oppose';
          }

          votes.push({
            division_id: div.id,
            division_name: div.name,
            date: div.date,
            vote_cast: row.vote_cast,
            aye_votes: div.aye_votes ?? 0,
            no_votes: div.no_votes ?? 0,
            issue_name: tag?.issue_name ?? null,
            aye_supports: tag?.aye_supports ?? null,
            vote_signal: voteSignal,
            source_url: div.source_url ?? null,
          });
        }

        const party = Array.isArray(member.party) ? member.party[0] : member.party;
        const electorate = Array.isArray(member.electorate) ? member.electorate[0] : member.electorate;

        setSummary({
          member_id: memberId,
          first_name: member.first_name,
          last_name: member.last_name,
          photo_url: member.photo_url,
          party_name: party?.name ?? 'Unknown',
          party_short: party?.short_name ?? null,
          party_colour: party?.colour ?? null,
          electorate: electorate?.name ?? '',
          total_votes: votes.length,
          votes,
          sitting_days: dateSet.size,
          week_label: weekLabel([...dateSet]),
          latest_date: latestDate,
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load');
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { summary, loading, error };
}
