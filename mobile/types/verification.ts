/**
 * Verification tier types for the Verity identity & trust model.
 *
 * Tier 0: Email-verified (default on signup)
 * Tier 1: Phone-verified (unlocks polls, community posts)
 * Tier 2: ID-verified (unlocks electorate petitions, high-trust actions)
 * Politician: Verified parliamentarian (unlocks official comms)
 */

export type VerificationTier = 'tier_0' | 'tier_1' | 'tier_2' | 'politician';

export type PoliticianRole =
  | 'prime_minister'
  | 'minister'
  | 'shadow_minister'
  | 'backbencher'
  | 'senator'
  | 'speaker'
  | 'president_senate';

export type ElectorateLevel = 'federal' | 'state' | 'local';

/**
 * Actions that require a minimum verification tier.
 * The client-side gating module uses these for UX (showing prompts, hiding CTAs).
 * The ACTUAL enforcement lives in RLS policies and Edge Functions — never trust the client.
 */
export type GatedAction =
  | 'vote_national_poll'
  | 'vote_electorate_poll'
  | 'sign_petition_national'
  | 'sign_petition_electorate'
  | 'follow_politician'
  | 'create_community_post'
  | 'react_to_bill'
  | 'contact_mp'
  | 'create_community_comment';

/**
 * Minimum tier required for each action.
 *
 * v1 policy: Tier 0 (signed-in via Apple/Google or email) is the maximum
 * tier required for any current action. No action requires tier_1 or tier_2.
 * Anonymous (not signed in) users still cannot perform any of these actions.
 *
 * Phone verification (tier_1) and ID verification (tier_2) are deferred.
 * See docs/CLEANUP_TODO.md for the re-enablement plan.
 *
 * Server-side enforcement mirrors these in RLS policies.
 */
export const ACTION_TIER_REQUIREMENTS: Record<GatedAction, VerificationTier> = {
  // All current actions require tier_0 (signed in)
  follow_politician: 'tier_0',
  react_to_bill: 'tier_0',
  contact_mp: 'tier_0',
  vote_national_poll: 'tier_0',
  vote_electorate_poll: 'tier_0',
  create_community_post: 'tier_0',
  create_community_comment: 'tier_0',
  sign_petition_national: 'tier_0',
  sign_petition_electorate: 'tier_0',
};

/** Ordered tiers from lowest to highest privilege */
export const TIER_ORDER: VerificationTier[] = ['tier_0', 'tier_1', 'tier_2', 'politician'];

/** Human-readable tier labels */
export const TIER_LABELS: Record<VerificationTier, string> = {
  tier_0: 'Email verified',
  tier_1: 'Phone verified',
  tier_2: 'Identity verified',
  politician: 'Verified politician',
};

/** What the user needs to do to reach each tier */
export const TIER_UPGRADE_CTA: Record<VerificationTier, string> = {
  tier_0: 'Sign in to get started',
  tier_1: 'Verify your phone number',
  tier_2: 'Verify your identity',
  politician: 'Contact Verity for politician verification',
};

/**
 * Compare two tiers. Returns true if `userTier` meets or exceeds `requiredTier`.
 */
export function tierMeetsRequirement(userTier: VerificationTier, requiredTier: VerificationTier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}
