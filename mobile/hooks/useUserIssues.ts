import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const LOCAL_KEY = 'tracked_issues';

/**
 * Gets/sets the user's selected issues from user_preferences.tracked_issues.
 * Falls back to device_id for anonymous users, persisting locally via AsyncStorage.
 */
export function useUserIssues(userId: string | null) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load issues on mount / when userId changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        if (userId) {
          // Authenticated user — read from Supabase
          const { data } = await supabase
            .from('user_preferences')
            .select('tracked_issues')
            .eq('user_id', userId)
            .maybeSingle();

          if (!cancelled) {
            setSelectedIssues(
              Array.isArray(data?.tracked_issues) ? data.tracked_issues : []
            );
          }
        } else {
          // Anonymous — read from AsyncStorage
          const raw = await AsyncStorage.getItem(LOCAL_KEY);
          if (!cancelled) {
            setSelectedIssues(raw ? JSON.parse(raw) : []);
          }
        }
      } catch {
        // Best-effort — keep current state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const toggleIssue = useCallback(async (issueId: string) => {
    setSelectedIssues(prev => {
      const next = prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId];

      // Persist in background (fire-and-forget)
      persistIssues(userId, next);
      return next;
    });
  }, [userId]);

  return { selectedIssues, toggleIssue, loading };
}

async function persistIssues(userId: string | null, issues: string[]) {
  try {
    if (userId) {
      await supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, tracked_issues: issues },
          { onConflict: 'user_id' }
        );
    } else {
      await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(issues));

      // Also try device_id upsert for future account migration
      const deviceId = await AsyncStorage.getItem('device_id');
      if (deviceId) {
        try {
          await supabase
            .from('user_preferences')
            .upsert(
              { device_id: deviceId, tracked_issues: issues },
              { onConflict: 'device_id' }
            );
        } catch {
          // Best-effort for anonymous users
        }
      }
    }
  } catch {
    // Non-critical — local state is already updated
  }
}
