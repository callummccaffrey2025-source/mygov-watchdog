# Verification Tier Rollout Plan

Date: 2026-04-29

---

## Tier Model

| Tier | How to reach | What it unlocks |
|------|-------------|-----------------|
| **Tier 0** | Sign in (email magic link or Apple Sign-In) | Browse everything, follow MPs, react to bills, contact MP, bookmark, share |
| **Tier 1** | Verify phone number (SMS OTP) | Vote in polls, create community posts/comments, sign national petitions |
| **Tier 2** | Verify identity (Stripe Identity or equivalent) | Sign electorate petitions, high-trust civic actions |
| **Politician** | Manual verification by Verity team via official parliamentary email | Official communications, verified seal on profile |

---

## Existing Account Migration

All existing accounts (auth.users) start at **Tier 0** by default.

- The `verification_tier` column on `user_preferences` defaults to `'tier_0'`.
- Any existing `user_preferences` rows (currently 0 in production) already have `tier_0`.
- Users who haven't created a `user_preferences` row yet get `tier_0` when the row is created during onboarding.
- **No data migration needed.** The default handles everything.

Anonymous device-only users have no auth session and no tier. The tier concept only applies once they sign in. Signing in creates a Tier 0 account automatically.

---

## Upgrade Paths

### Tier 0 → Tier 1 (Phone Verification)

**Trigger:** User attempts a Tier 1 action (e.g. taps "Vote" on a poll).

**Flow:**
1. Client calls `requiresUpgrade(userId, 'vote_national_poll')` → returns `{ required: true, targetTier: 'tier_1', upgradeMessage: 'Verify your phone number' }`
2. Client shows upgrade prompt with "Verify your phone" CTA
3. User enters phone number → client calls `verify-phone-send-otp` Edge Function
4. Edge Function sends SMS OTP via Twilio (or stubbed for now), stores `phone_hash` + `attempt_count` in `phone_verifications`
5. User enters OTP → client calls `verify-phone-confirm-otp` Edge Function
6. Edge Function validates OTP, calls `upgrade_user_tier(user_id, 'tier_1', 'twilio', reference_id)` (SECURITY DEFINER function)
7. `upgrade_user_tier` updates `user_preferences.verification_tier`, sets `phone_verified_at`, logs to `verification_audit_log`
8. Client calls `invalidateTierCache()` and retries the original action

**Anti-abuse:**
- Max 5 OTP attempts per phone hash per 24 hours (enforced by Edge Function)
- Rate limit: 3 OTP sends per user per hour
- Phone hash stored, never raw number

### Tier 1 → Tier 2 (ID Verification)

**Trigger:** User attempts a Tier 2 action (e.g. signs an electorate petition).

**Flow:**
1. Client shows upgrade prompt: "Verify your identity to sign petitions for your electorate"
2. Opens Stripe Identity verification flow (in-app browser or native SDK)
3. On completion, Stripe webhook hits `verify-identity-webhook` Edge Function
4. Edge Function validates webhook signature, calls `upgrade_user_tier(user_id, 'tier_2', 'stripe_identity', stripe_verification_id)`
5. No raw ID data stored — only Stripe's reference ID and `id_verified_at` timestamp

### Politician Verification

**Not self-service.** Verity team manually verifies via:
1. Politician contacts Verity
2. Team sends verification link to their `@aph.gov.au` email
3. Politician clicks link, confirming ownership
4. Team calls `upgrade_user_tier(user_id, 'politician', 'manual', reference)` via admin tool

---

## Server-Side Enforcement

This is the security boundary. The client gating module (`lib/auth/verification.ts`) is UX-only — it shows prompts and hides CTAs. The server enforces independently.

### Enforcement Matrix

| Gated Action | Required Tier | RLS Policy | Edge Function |
|-------------|---------------|------------|---------------|
| **Vote in poll** | tier_1 | `"Tier 1 required to vote in polls"` on `poll_votes` FOR INSERT | `vote-on-poll` (validates tier before insert) |
| **Create community post** | tier_1 | `"Tier 1 required to create community posts"` on `community_posts` FOR INSERT | N/A (RLS sufficient) |
| **Create community comment** | tier_1 | (to be added on `community_comments`) | N/A (RLS sufficient) |
| **Sign national petition** | tier_1 | (to be added on `petition_signatures` when table created) | `sign-petition` (validates tier + dedup) |
| **Sign electorate petition** | tier_2 | (to be added on `petition_signatures` with electorate check) | `sign-petition` (validates tier + electorate match) |
| **Follow MP** | tier_0 | Existing policy (any authenticated user) | N/A |
| **React to bill** | tier_0 | Existing policy (any authenticated user) | N/A |
| **Contact MP** | tier_0 | N/A (opens mailto: link, no server write) | N/A |

### Tier Column Protection

Users **cannot** modify their own `verification_tier` via the Supabase client:

- **RLS policy:** `"Users update own preferences excluding verification"` on `user_preferences` — the WITH CHECK clause ensures `verification_tier`, `phone_verified_at`, `id_verified_at`, `verification_provider`, and `verification_reference_id` match existing values on any UPDATE.
- **CHECK constraint:** `chk_verification_tier` restricts values to `('tier_0', 'tier_1', 'tier_2', 'politician')`.
- **Upgrade path:** Only the `upgrade_user_tier()` SECURITY DEFINER function can change these columns. It runs as table owner, bypassing RLS.
- **Function access:** `REVOKE EXECUTE ON FUNCTION upgrade_user_tier FROM anon, authenticated` — only service role can call it.

### Edge Functions That Enforce Tier

| Edge Function | Tier Check | Status |
|---------------|-----------|--------|
| `verify-phone-send-otp` | N/A (any auth user can request) | To be built |
| `verify-phone-confirm-otp` | Calls `upgrade_user_tier()` on success | To be built |
| `verify-identity-webhook` | Calls `upgrade_user_tier()` on success | To be built |
| `vote-on-poll` | Checks `get_user_tier(auth.uid())` before insert | Existing (needs tier check added) |
| `sign-petition` | Checks tier + electorate match | To be built |

---

## What's Deployed Now vs. What's Stubbed

### Deployed and active:
- `verification_tier` column on `user_preferences` with CHECK constraint and default `'tier_0'`
- `phone_verified_at`, `id_verified_at`, `verification_provider`, `verification_reference_id` columns
- `verification_audit_log` table with RLS
- `phone_verifications` table with RLS
- `upgrade_user_tier()` SECURITY DEFINER function (revoked from anon/authenticated)
- `get_user_tier()` and `user_meets_tier()` helper functions
- Tier-gated RLS policies on `poll_votes` and `community_posts`
- RLS policy protecting verification columns from client-side UPDATE
- `members.official_email_domain`, `verity_seal_active`, `contact_channels`, `bio` columns
- `parties.website_url`, `leader_politician_id` columns
- `electorates.current_mp_id` backfilled (148 electorates linked)
- Client-side `types/verification.ts` with tier types and action requirements
- Client-side `lib/auth/verification.ts` with `getUserTier()`, `canPerformAction()`, `requiresUpgrade()`

### To be built (future sessions):
- `verify-phone-send-otp` Edge Function (Twilio integration)
- `verify-phone-confirm-otp` Edge Function
- `verify-identity-webhook` Edge Function (Stripe Identity integration)
- Phone verification UI screen (`PhoneVerificationScreen`)
- ID verification UI screen
- Upgrade prompt component (reusable modal shown when tier gate triggers)
- Tier badge on user profile
- Politician verification admin workflow

---

## Rollback Plan

All migrations are additive (new columns with defaults, new tables). To roll back:

1. **Columns:** `ALTER TABLE user_preferences DROP COLUMN verification_tier CASCADE;` (and the other 4 columns)
2. **Tables:** `DROP TABLE verification_audit_log; DROP TABLE phone_verifications;`
3. **Functions:** `DROP FUNCTION upgrade_user_tier; DROP FUNCTION get_user_tier; DROP FUNCTION user_meets_tier;`
4. **RLS policies:** `DROP POLICY "Tier 1 required to vote in polls" ON poll_votes;` etc.

No existing functionality depends on these new columns/tables, so dropping them has zero impact on the current app.
