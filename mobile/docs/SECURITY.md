# Security Audit

Last updated: 2026-05-10 (Phase 4, Prompt 24)

---

## RLS Status

All 92 public tables have Row Level Security **enabled**. No tables are locked out (all have at least one policy).

### User data tables — own-data-only access

All user data tables enforce `user_id = auth.uid()` for writes and reads:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `user_preferences` | Own only | Own only | Own only (verification fields immutable) | Own only |
| `user_follows` | Own only | Own only | Own only | Own only |
| `user_reads` | Own only | Own + anon (device_id) | — | — |
| `user_interactions` | Own + anon | Own + anon | Own + anon | Own + anon |
| `user_saves` | Own only | Own only | Own only | Own only |
| `user_profiles` | Own only | Own only | Own only | Own only |
| `push_tokens` | Own only | Own only | Own only | Own only |
| `notification_preferences` | Own only | Own only | Own only | Own only |
| `analytics_events` | Own only | Own only | — | — |
| `mp_messages` | Own only | Own only | Own only | Own only |

### Community tables — public read, own-only write

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `community_posts` | Authenticated read | Own only (+ tier_1 policy, currently bypassed) | Own only | Own only |
| `community_comments` | Authenticated read | Own only | Own only | Own only |
| `community_votes` | Authenticated read | Own only | Own only | Own only |
| `community_reports` | Own only | Own only | — | — |

### Public data tables — anon + authenticated read

These are public parliamentary data. Writes restricted to service_role (ingestion scripts):

members, bills, divisions, division_votes, parties, electorates, news_articles, news_stories, daily_briefs, published_polls, hansard_entries, donations, individual_donations, registered_interests, government_contracts, electorate_demographics, councils, councillors, state_members, state_bills, party_policies, sitting_calendar

### Sensitive tables — service_role only

| Table | Access |
|-------|--------|
| `phone_verifications` | service_role writes, users read own |
| `verification_audit_log` | service_role inserts, users read own |
| `email_domain_blocklist` | service_role only |

---

## Fixes applied in this audit

| Fix | Details |
|-----|---------|
| `published_polls` anon read | Added `Public read published polls` policy for anon role. Was locked to authenticated only — broke browse-without-signing-in. |

---

## Known security notes

### community_posts tier bypass
The `community_posts` table has two PERMISSIVE INSERT policies:
1. `Tier 1 required to create community posts` — requires `user_meets_tier('tier_1')`
2. `community_posts_insert_own` — only requires `user_id = auth.uid()`

Since both are PERMISSIVE, policy #2 bypasses the tier requirement. This is **intentional** — phone verification (Tier 1) is deferred per BACKLOG.md. When re-enabled, remove `community_posts_insert_own` to enforce the tier gate.

### user_preferences verification fields
The `Users update own preferences excluding verification` policy prevents users from self-modifying `verification_tier`, `phone_verified_at`, `id_verified_at`, `verification_provider`, and `verification_reference_id`. These can only be changed by service_role (via Edge Functions). This is correct.

### Anonymous device-id tracking
`user_interactions` and `user_reads` allow inserts where `user_id IS NULL` — this is intentional for device-id-based tracking of users who haven't signed in.

---

## Edge Function authentication

| Function | verify_jwt | Reason |
|----------|-----------|--------|
| `revenuecat-webhook` | false | Receives external POST from RevenueCat servers |
| `generate-daily-brief` | false | Called by pg_cron (no JWT available) |
| `bill-change-notify` | false | Called by pg_cron |
| `data-quality-check` | false | Called by pg_cron |
| `generate-bill-summary` | false | Called by pg_cron |
| `generate-daily-poll` | false | Called by pg_cron |
| `ingest-news` | true | Called by pg_cron with service_role key |
| All others | true | Require authenticated user JWT |

---

## Vault secrets

13 secrets in Supabase Vault. 6 auto-managed by Supabase, 7 user-managed:

| Secret | Status |
|--------|--------|
| `ANTHROPIC_API_KEY` | Active — used by AI features |
| `TWILIO_ACCOUNT_SID` | Deferred — phone verification |
| `TWILIO_AUTH_TOKEN` | Deferred — phone verification |
| `TWILIO_VERIFY_SERVICE_SID` | Deferred — phone verification |
| `RESEND_API_KEY` | Deferred — weekly digest |
| `DIGEST_FROM_EMAIL` | Deferred — weekly digest |
| `APPLE_SHARED_SECRET` | **Not yet set** — needed for validate-receipt |

---

## Recommendations

1. **Set `APPLE_SHARED_SECRET`** in Vault before enabling IAP
2. **Rate limiting**: Not currently implemented on Edge Functions. Consider adding rate limiting headers or Supabase's built-in rate limiting for `verify-claim` and `validate-receipt`
3. **Content moderation**: Community posts have report system but no automated moderation. Consider adding content filtering before launch
