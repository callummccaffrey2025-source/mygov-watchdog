import AsyncStorage from './storage';
import { supabase } from './supabase';

/**
 * Feature flags — simple flag system for legal gating and progressive rollout.
 *
 * Flags default to the DEFAULTS below. On app start, remote overrides are
 * fetched from Supabase `feature_flags` table (if it exists). Legal-gated
 * features default OFF and can only be enabled via the remote table after
 * lawyer sign-off.
 *
 * Table: feature_flags
 *   flag_key text PK
 *   enabled boolean default false
 *   updated_at timestamptz default now()
 */

export type FeatureFlag =
  | 'conflict_radar'
  | 'voice_to_action'
  | 'ballot_decoded'
  | 'wallet_calculator'
  | 'community_factcheck'
  | 'news_accountability'
  | 'verity_verdict';

const DEFAULTS: Record<FeatureFlag, boolean> = {
  conflict_radar: false,       // LEGAL GATE
  voice_to_action: false,      // LEGAL GATE
  ballot_decoded: false,       // LEGAL GATE
  wallet_calculator: true,
  community_factcheck: true,
  news_accountability: true,
  verity_verdict: true,
};

const CACHE_KEY = 'verity_feature_flags';
let _flags: Record<string, boolean> = { ...DEFAULTS };
let _loaded = false;

/** Initialize flags — call once at app start. Non-blocking. */
export async function initFeatureFlags(): Promise<void> {
  // Load cached flags first for instant availability
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      _flags = { ...DEFAULTS, ...parsed };
    }
  } catch {}

  // Then fetch remote overrides
  try {
    const { data } = await supabase
      .from('feature_flags')
      .select('flag_key, enabled');

    if (data && data.length > 0) {
      const remote: Record<string, boolean> = {};
      for (const row of data) {
        remote[row.flag_key] = row.enabled;
      }
      _flags = { ...DEFAULTS, ...remote };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_flags));
    }
  } catch {
    // Remote unavailable — use cached/defaults
  }

  _loaded = true;
}

/** Check if a feature is enabled */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return _flags[flag] ?? DEFAULTS[flag] ?? false;
}

/** Get all flag states (for debug/admin screens) */
export function getAllFlags(): Record<FeatureFlag, boolean> {
  return { ...DEFAULTS, ..._flags } as Record<FeatureFlag, boolean>;
}

/** Whether flags have been loaded from remote */
export function flagsLoaded(): boolean {
  return _loaded;
}
