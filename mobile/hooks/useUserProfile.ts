import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface UserProfile {
  postcode: string | null;
  electorate: string | null;
  state: string | null;
  selected_topics: string[];
  tracked_issues: string[];
  housing_status: string | null;
  age_bracket: string | null;
  income_bracket: string | null;
  household_type: string | null;
  onboarding_completed_at: string | null;
}

const EMPTY_PROFILE: UserProfile = {
  postcode: null,
  electorate: null,
  state: null,
  selected_topics: [],
  tracked_issues: [],
  housing_status: null,
  age_bracket: null,
  income_bracket: null,
  household_type: null,
  onboarding_completed_at: null,
};

export function useUserProfile() {
  const { user, signOut } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('postcode, electorate, state, selected_topics, tracked_issues, housing_status, age_bracket, income_bracket, household_type, onboarding_completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          postcode: data.postcode ?? null,
          electorate: data.electorate ?? null,
          state: data.state ?? null,
          selected_topics: Array.isArray(data.selected_topics) ? data.selected_topics : [],
          tracked_issues: Array.isArray(data.tracked_issues) ? data.tracked_issues : [],
          housing_status: data.housing_status ?? null,
          age_bracket: data.age_bracket ?? null,
          income_bracket: data.income_bracket ?? null,
          household_type: data.household_type ?? null,
          onboarding_completed_at: data.onboarding_completed_at ?? null,
        });
      } else {
        setProfile({ ...EMPTY_PROFILE });
      }
    } catch {
      setProfile({ ...EMPTY_PROFILE });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    if (!user) return;
    // Optimistic update
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, [field]: value },
          { onConflict: 'user_id' },
        );
      if (error) {
        // Revert on failure
        await fetchProfile();
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch {
      await fetchProfile();
    }
  }, [user?.id, fetchProfile]);

  const deleteAllData = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (error) {
        Alert.alert('Error', 'Failed to delete account. Please try again.');
        return;
      }
      await AsyncStorage.clear();
      await signOut();
    } catch {
      Alert.alert('Error', 'Failed to delete account. Please contact support@verity.au');
    }
  }, [user?.id, signOut]);

  const exportData = useCallback(async (): Promise<string> => {
    if (!user) return JSON.stringify({ error: 'Not signed in' });

    const results: Record<string, unknown> = {};

    const [prefsResult, followsResult, savesResult, interactionsResult] = await Promise.all([
      supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_follows')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_saves')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_interactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    results.preferences = prefsResult.data ?? null;
    results.follows = followsResult.data ?? [];
    results.saves = savesResult.data ?? [];
    results.interactions = interactionsResult.data ?? [];
    results.exported_at = new Date().toISOString();
    results.user_id = user.id;

    return JSON.stringify(results, null, 2);
  }, [user?.id]);

  return { profile, loading, updateField, deleteAllData, exportData, refresh: fetchProfile };
}
