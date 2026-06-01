import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';

/**
 * User issue stances — reads/writes positions on policy issues.
 *
 * Table: user_issue_stances (device_id, issue_id uuid, stance -1/0/+1, importance 1-3)
 * Table: policy_issues (id uuid, slug, name, stance_question, support_label, oppose_label, icon)
 */

export interface PolicyIssue {
  id: string;
  slug: string;
  name: string;
  stance_question: string;
  support_label: string;
  oppose_label: string;
  icon: string | null;
}

export interface UserStance {
  issue_id: string;
  issue_slug: string;
  stance: number;       // -1, 0, +1
  importance: number;   // 1-3
}

export function useIssueStances() {
  const [issues, setIssues] = useState<PolicyIssue[]>([]);
  const [stances, setStances] = useState<UserStance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const deviceId = await AsyncStorage.getItem('device_id');

        const [issuesResult, stancesResult] = await Promise.all([
          supabase
            .from('policy_issues')
            .select('id, slug, name, stance_question, support_label, oppose_label, icon')
            .eq('active', true)
            .order('sort_order'),
          deviceId
            ? supabase
                .from('user_issue_stances')
                .select('issue_id, stance, importance, policy_issues(slug)')
                .eq('device_id', deviceId)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          setIssues((issuesResult.data as PolicyIssue[]) ?? []);
          setStances(
            ((stancesResult.data ?? []) as any[]).map(s => ({
              issue_id: s.issue_id,
              issue_slug: s.policy_issues?.slug ?? '',
              stance: s.stance,
              importance: s.importance,
            })),
          );
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const setStance = useCallback(async (issueId: string, issueSlug: string, stance: number, importance: number = 2) => {
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) return;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('user_issue_stances')
      .upsert(
        {
          device_id: deviceId,
          user_id: user?.id ?? null,
          issue_id: issueId,
          stance,
          importance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id,issue_id' },
      );

    setStances(prev => {
      const existing = prev.findIndex(s => s.issue_id === issueId);
      const updated = { issue_id: issueId, issue_slug: issueSlug, stance, importance };
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = updated;
        return copy;
      }
      return [...prev, updated];
    });
  }, []);

  const getStance = useCallback(
    (issueId: string): UserStance | undefined =>
      stances.find(s => s.issue_id === issueId),
    [stances],
  );

  const hasCompleted = stances.filter(s => s.stance !== 0).length >= Math.min(issues.length, 5);

  return { issues, stances, loading, setStance, getStance, hasCompleted };
}
