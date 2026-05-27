import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';

/**
 * User issue stances — reads/writes positions on policy issues.
 *
 * Table: user_issue_stances
 *   device_id text, user_id uuid nullable, issue_slug text,
 *   stance int (-2 strongly disagree to +2 strongly agree),
 *   importance int (1-3), created_at, updated_at
 *
 * Table: policy_issues
 *   slug text PK, name text, description text, topic text
 */

export interface PolicyIssue {
  slug: string;
  name: string;
  description: string;
  topic: string;
}

export interface UserStance {
  issue_slug: string;
  stance: number;       // -2 to +2
  importance: number;   // 1-3
}

export function useIssueStances() {
  const [issues, setIssues] = useState<PolicyIssue[]>([]);
  const [stances, setStances] = useState<UserStance[]>([]);
  const [loading, setLoading] = useState(true);

  // Load issues + existing stances
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const deviceId = await AsyncStorage.getItem('device_id');

        const [issuesResult, stancesResult] = await Promise.all([
          supabase.from('policy_issues').select('slug, name, description, topic').order('name'),
          deviceId
            ? supabase
                .from('user_issue_stances')
                .select('issue_slug, stance, importance')
                .eq('device_id', deviceId)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          setIssues((issuesResult.data as PolicyIssue[]) ?? []);
          setStances((stancesResult.data as UserStance[]) ?? []);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const setStance = useCallback(async (issueSlug: string, stance: number, importance: number = 2) => {
    const deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) return;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from('user_issue_stances')
      .upsert(
        {
          device_id: deviceId,
          user_id: user?.id ?? null,
          issue_slug: issueSlug,
          stance,
          importance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'device_id,issue_slug' },
      );

    setStances(prev => {
      const existing = prev.findIndex(s => s.issue_slug === issueSlug);
      const updated = { issue_slug: issueSlug, stance, importance };
      if (existing >= 0) {
        const copy = [...prev];
        copy[existing] = updated;
        return copy;
      }
      return [...prev, updated];
    });
  }, []);

  const getStance = useCallback(
    (issueSlug: string): UserStance | undefined =>
      stances.find(s => s.issue_slug === issueSlug),
    [stances],
  );

  const hasCompleted = stances.length >= Math.min(issues.length, 5);

  return { issues, stances, loading, setStance, getStance, hasCompleted };
}
