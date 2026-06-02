import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ElectorateConsensusItem {
  issue_id: string;
  issue_name: string;
  electorate_agree_pct: number;  // % of electorate respondents who agree
  electorate_disagree_pct: number;
  mp_position: 'for' | 'against' | 'mixed' | 'unknown';
  respondent_count: number;
  gap: number;  // |electorate position - MP position|, 0-100
}

export function useElectorateConsensus(electorateName: string | null, memberId: string | null) {
  const [items, setItems] = useState<ElectorateConsensusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electorateName || !memberId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Get all stances from users in this electorate
        // user_preferences has electorate name, user_issue_stances has device_id
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('device_id')
          .eq('electorate', electorateName);

        if (!prefs?.length) { setLoading(false); return; }
        const deviceIds = prefs.map(p => p.device_id);

        // Get all stances from these devices
        const { data: stances } = await supabase
          .from('user_issue_stances')
          .select('issue_id, stance, device_id')
          .in('device_id', deviceIds);

        if (!stances?.length) { setLoading(false); return; }

        // Get issue names
        const issueIds = [...new Set(stances.map(s => s.issue_id))];
        const { data: issues } = await supabase
          .from('issue_catalog')
          .select('id, name')
          .in('id', issueIds);

        const issueMap = new Map((issues || []).map(i => [i.id, i.name]));

        // Aggregate by issue: stance > 0 = agree, stance < 0 = disagree
        const byIssue = new Map<string, { agree: number; disagree: number; total: number }>();
        for (const s of stances) {
          const existing = byIssue.get(s.issue_id) || { agree: 0, disagree: 0, total: 0 };
          if (s.stance > 0) existing.agree++;
          else if (s.stance < 0) existing.disagree++;
          existing.total++;
          byIssue.set(s.issue_id, existing);
        }

        // Get MP's voting position from division_issue_tags
        const { data: mpVotes } = await supabase
          .from('division_votes')
          .select('vote_cast, division:divisions(id)')
          .eq('member_id', memberId)
          .limit(500);

        // Get issue tags for those divisions
        const divIds = (mpVotes || []).map((v: any) => v.division?.id).filter(Boolean);
        const { data: tags } = await supabase
          .from('division_issue_tags')
          .select('division_id, issue_id, position')
          .in('division_id', divIds);

        // Build MP position per issue
        const mpPositions = new Map<string, string>();
        for (const t of (tags || [])) {
          mpPositions.set(t.issue_id, t.position);
        }

        // Build result items with gap calculation
        const results: ElectorateConsensusItem[] = [];
        for (const [issueId, counts] of byIssue) {
          if (counts.total < 3) continue; // Minimum respondents
          const agreePct = Math.round((counts.agree / counts.total) * 100);
          const disagreePct = Math.round((counts.disagree / counts.total) * 100);
          const mpPos = mpPositions.get(issueId) as 'for' | 'against' | 'mixed' | undefined;

          // Calculate gap: if electorate agrees but MP votes against (or vice versa)
          let gap = 0;
          if (mpPos === 'for' && disagreePct > agreePct) gap = disagreePct;
          else if (mpPos === 'against' && agreePct > disagreePct) gap = agreePct;
          else if (mpPos === 'for') gap = Math.max(0, disagreePct - 20);
          else if (mpPos === 'against') gap = Math.max(0, agreePct - 20);

          results.push({
            issue_id: issueId,
            issue_name: issueMap.get(issueId) || 'Unknown issue',
            electorate_agree_pct: agreePct,
            electorate_disagree_pct: disagreePct,
            mp_position: mpPos || 'unknown',
            respondent_count: counts.total,
            gap,
          });
        }

        results.sort((a, b) => b.gap - a.gap);
        if (!cancelled) setItems(results.slice(0, 5));
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [electorateName, memberId]);

  return { items, loading };
}
