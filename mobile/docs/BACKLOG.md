# Backlog

Last updated: 2026-05-05 (Prompt 2)

---

## Tech Debt

- [ ] `politicians` table (226 rows) exists alongside `members` table (225 rows) — investigate overlap in Prompt 4 (schema audit)
- [ ] `bill_electorate_sentiment` (790 rows), `donor_influence` (637 rows), `political_risk` (226 rows) — investigate if any code references these
- [ ] `digest_log` table (0 rows) — may be referenced by weekly-digest Edge Function
- [ ] `poll_admin_actions`, `poll_reports` tables — created for Daily Question admin, keep if AdminPollsScreen uses them
- [ ] `email_domain_blocklist` (16 rows) — verify-phone-send-otp uses this, keep while phone verification is mothballed
- [ ] NewsScreen vs NewsScreenV2 — both exist, NewsScreen used in stack only, NewsScreenV2 used as tab. Consider consolidating.

## Deferred Features

- [ ] **Phone verification (Tier 1)** — Schema, functions, and Edge Functions (`verify-phone-send-otp`, `verify-phone-confirm-otp`) are deployed but UI removed. To re-enable: add PhoneVerificationScreen back to App.tsx, add banner to ProfileScreen, update ACTION_TIER_REQUIREMENTS in types/verification.ts.
- [ ] **Weekly email digest** — Edge Function source exists (`weekly-digest/index.ts`), uses Resend. Cron unscheduled. To re-enable: set RESEND_API_KEY secret, reschedule cron `SELECT cron.schedule('weekly-digest', '0 8 * * 0', ...)`.
- [ ] **ID verification (Tier 2)** — Schema exists (`verification_tier` column supports it). No UI or vendor integration built.
- [ ] **Promise Tracker** — Feature deferred to post-launch. Screen deleted. Data tables (`promises`) have 0 rows.
- [ ] **Petitions** — Not built. Schema would need `petition_signatures` table with tier-gated RLS.
- [ ] **Council/state expansion** — Deferred to post-launch per roadmap.
- [ ] **WeeklyPollCard replacement** — The old WeeklyPollCard was removed from HomeScreen. Consider adding a "Latest federal polling" card showing the published poll aggregate instead.

## Pre-Launch Blockers

- [ ] IAP integration (RevenueCat) — subscription is a database flag, Apple will reject
- [ ] Privacy Policy update — missing ABN, cross-border data disclosure
- [ ] Terms of Service update — missing AI disclaimer section
- [ ] Accessibility labels — ~4 out of 600+ interactive elements have labels
- [ ] App icon — verify RGB format, no transparency, no rounded corners

## Post-Launch Improvements

- [ ] react-native-svg + victory-native for polling trend chart (Phase 2, Prompt 14)
- [ ] Sentry integration for crash tracking
- [ ] PostHog analytics
- [ ] Offline caching layer
- [ ] Retry logic with exponential backoff on all hooks
- [ ] Server-side poll vote aggregation (replace client-side counting)
