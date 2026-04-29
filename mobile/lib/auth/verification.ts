/**
 * Client-side verification gating module.
 *
 * THIS IS FOR UX ONLY — showing upgrade prompts, hiding locked features,
 * deciding which CTAs to render.
 *
 * THIS IS NOT THE SECURITY BOUNDARY. Server-side enforcement lives in:
 * - RLS policies on tables (poll_votes, community_posts, etc.)
 * - Edge Functions that validate tier before performing actions
 * - The upgrade_user_tier() SECURITY DEFINER function in Postgres
 *
 * Never trust the client. A user could patch this module and call the
 * API directly. The server must reject unauthorized actions independently.
 */

import { supabase } from '../supabase';
import {
  VerificationTier,
  GatedAction,
  ACTION_TIER_REQUIREMENTS,
  TIER_UPGRADE_CTA,
  tierMeetsRequirement,
} from '../../types/verification';

// ── Session cache ───────────────────────────────────────────────────────────
// Read the tier once per session, invalidate on verification events.

let cachedTier: VerificationTier | null = null;
let cachedUserId: string | null = null;

/** Clear the cached tier (call after verification completes) */
export function invalidateTierCache(): void {
  cachedTier = null;
  cachedUserId = null;
}

/**
 * Get the current user's verification tier.
 * Reads from Supabase on first call, caches for the session.
 * Returns 'tier_0' if no user is signed in or no preferences row exists.
 */
export async function getUserTier(userId: string | null | undefined): Promise<VerificationTier> {
  if (!userId) return 'tier_0';

  // Return cached if same user
  if (cachedUserId === userId && cachedTier !== null) {
    return cachedTier;
  }

  try {
    const { data } = await supabase
      .from('user_preferences')
      .select('verification_tier')
      .eq('user_id', userId)
      .maybeSingle();

    const tier = (data?.verification_tier as VerificationTier) ?? 'tier_0';
    cachedTier = tier;
    cachedUserId = userId;
    return tier;
  } catch {
    return 'tier_0';
  }
}

/**
 * Check if a user can perform a gated action.
 * Returns true if their tier meets the action's requirement.
 *
 * For UX decisions only — the server enforces independently.
 */
export async function canPerformAction(
  userId: string | null | undefined,
  action: GatedAction,
): Promise<boolean> {
  const tier = await getUserTier(userId);
  const required = ACTION_TIER_REQUIREMENTS[action];
  return tierMeetsRequirement(tier, required);
}

/**
 * Check if an action requires a tier upgrade, and if so, what tier.
 * Returns { required: false } if the user already qualifies.
 * Returns { required: true, targetTier, upgradeMessage } if they need to upgrade.
 *
 * Use this to decide whether to show an upgrade prompt vs. performing the action.
 */
export async function requiresUpgrade(
  userId: string | null | undefined,
  action: GatedAction,
): Promise<{
  required: boolean;
  targetTier?: VerificationTier;
  upgradeMessage?: string;
}> {
  const tier = await getUserTier(userId);
  const required = ACTION_TIER_REQUIREMENTS[action];

  if (tierMeetsRequirement(tier, required)) {
    return { required: false };
  }

  return {
    required: true,
    targetTier: required,
    upgradeMessage: TIER_UPGRADE_CTA[required],
  };
}
