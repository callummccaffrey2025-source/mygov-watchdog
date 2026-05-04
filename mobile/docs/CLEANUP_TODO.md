# Cleanup & Deferred Items

Items that are built but disabled, or flagged for future sessions.

---

## Phone Verification (Deferred)

**Status:** Schema + functions deployed but UI disabled.

**What exists:**
- `user_preferences.verification_tier` column with CHECK constraint
- `phone_verifications` table
- `verification_audit_log` table
- `upgrade_user_tier()` SECURITY DEFINER function
- `get_user_tier()` and `user_meets_tier()` helper functions
- Tier-gated RLS policies on `poll_votes` and `community_posts`
- `PhoneVerificationScreen.tsx` (file exists, not in navigator)
- `verify-phone-send-otp` and `verify-phone-confirm-otp` edge functions (stubs)
- `types/verification.ts` and `lib/auth/verification.ts` (client-side gating)

**What's disabled:**
- Phone verification banner removed from ProfileScreen
- PhoneVerificationScreen removed from App.tsx Stack.Navigator
- All `ACTION_TIER_REQUIREMENTS` set to `tier_0` (signed-in is sufficient)
- No action in v1 requires tier_1 or tier_2

**How to re-enable:**
1. Uncomment the PhoneVerificationScreen import and Stack.Screen in App.tsx
2. Add the phone verification banner back to ProfileScreen
3. Update `ACTION_TIER_REQUIREMENTS` to require `tier_1` for desired actions
4. Deploy the Twilio-backed `verify-phone-send-otp` edge function
5. The RLS policies are already in place — they'll start enforcing once user tiers are above tier_0

---

## WeeklyPollCard on HomeScreen

**Status:** Still renders on HomeScreen (line ~699) using `useWeeklyPoll` hook.

**Issue:** The weekly_polls table has 1 row and 0 votes. This card shows a generic poll that nobody has interacted with.

**TODO:** Either:
- Remove WeeklyPollCard from HomeScreen and replace with a "Latest federal polling" headline card showing the published poll aggregate (ALP 53.8 — LNP 46.2)
- Or remove the section entirely if the Polls tab is sufficient

---

## Old User-Generated Poll Tables

**Status:** Tables exist with minimal/zero data. Not deleted.

| Table | Rows | Action |
|-------|------|--------|
| `verity_polls` | 9 | Leave — seeded demo data, no user impact |
| `poll_votes` | 0 | Leave — no data to lose |
| `poll_options` | ~36 | Leave — tied to verity_polls |
| `weekly_polls` | 1 | Leave — used by WeeklyPollCard (see above) |
| `weekly_poll_votes` | 0 | Leave |
| `poll_results_by_electorate` | 0 | Leave |
| `poll_results_by_state` | 0 | Leave |
| `poll_results_national` | 0 | Leave |

These can be dropped in a future cleanup session once the WeeklyPollCard is removed from HomeScreen.

---

## Dead Code Files

These files exist on disk but are no longer imported:
- `screens/ClaimProfileScreen.tsx` — old MP claim system, removed from nav
- `screens/CompareScreen.tsx` — replaced by CompareMPsScreen, never registered
- `screens/CreatePostScreen.tsx` — old official posts system, removed
- `screens/PostDetailScreen.tsx` — old official posts system, removed
- `components/PostCard.tsx` — old official posts system, not imported
- `hooks/useOfficialPosts.ts` — old official posts system, not imported
- `hooks/useVerifiedOfficial.ts` — old verified officials system

Can be deleted in a cleanup session.
