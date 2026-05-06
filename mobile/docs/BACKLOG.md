# Backlog

Single source of truth for all deferred work, tech debt, and blocked items.
If you're about to write a TODO in code, check here first.

Last updated: 2026-05-05 (Prompt 3 — consolidated from CLEANUP_TODO.md, inline TODOs, and previous BACKLOG.md)

---

## Pre-launch blockers

Things that MUST be done before App Store submission.

| Item | Why it's a blocker | Roadmap prompt |
|------|-------------------|----------------|
| **IAP integration (RevenueCat)** | Subscription is a database flag (`is_pro` on `user_preferences`). No StoreKit, no receipt validation. Apple will reject. | Not yet assigned — needs dedicated session |
| **Privacy Policy update** | Missing ABN/business entity name, cross-border data disclosure (Supabase in US, Anthropic in US), PostHog tracking disclosure. Required by Australian Privacy Act 1988 APP 1 and APP 8. | Prompt 39 |
| **Terms of Service update** | Missing AI-specific disclaimer section. No indemnification for user-generated content. Contact emails inconsistent (verity.run vs verity.au). | Prompt 39 |
| **Accessibility labels** | ~4 of 600+ interactive elements have accessibilityLabel. VoiceOver is non-functional. Apple may flag. Disability Discrimination Act 1992 obligation. | Prompt 37 |
| **App icon verification** | Verify icon is 1024x1024 RGB PNG with no transparency and no pre-rounded corners. Currently appears correct but needs final check. | Callum manual check |
| **Supabase Site URL** | Must be set to `verity://auth-callback` for email magic links to work. Currently set (verify it's still correct before submission). | Done — verify only |

---

## Deferred features

Features cut from v1, planned for post-launch.

### Phone verification (Tier 1)
- **Original scope:** SMS OTP verification to unlock polls, community posts, petitions
- **Why deferred:** Published poll aggregation replaced user-generated polls. No manipulation surface to defend → no phone verification needed for v1.
- **What exists:** Schema (`verification_tier`, `phone_verifications`, `verification_audit_log` tables), `upgrade_user_tier()` SECURITY DEFINER function, `get_user_tier()` / `user_meets_tier()` helper functions, RLS policies on `poll_votes` and `community_posts`, Edge Functions deployed (`verify-phone-send-otp`, `verify-phone-confirm-otp`), client types + gating module (`types/verification.ts`, `lib/auth/verification.ts`)
- **How to re-enable:** (1) Create PhoneVerificationScreen, (2) register in App.tsx navigator, (3) add CTA to ProfileScreen, (4) update `ACTION_TIER_REQUIREMENTS` to require `tier_1` for desired actions, (5) configure Twilio credentials in Supabase secrets
- **Effort:** 1-2 sessions
- **Dependencies:** Twilio account, verified phone number for sending

### ID verification (Tier 2)
- **Original scope:** Identity verification via Stripe Identity for electorate petitions
- **Why deferred:** Petitions feature deferred → no need for ID verification
- **What exists:** Schema column (`verification_tier` supports `tier_2`)
- **Effort:** 2-3 sessions (Stripe Identity integration + UI)
- **Dependencies:** Stripe Identity account, privacy impact assessment

### Weekly email digest
- **Original scope:** Weekly "This Week in Australian Politics" email via Resend
- **Why deferred:** RESEND_API_KEY never configured. Newsletter feature cancelled.
- **What exists:** Edge Function source (`weekly-digest/index.ts`), deployed but cron unscheduled
- **How to re-enable:** Set `RESEND_API_KEY` and `DIGEST_FROM_EMAIL` Supabase secrets, reschedule cron: `SELECT cron.schedule('weekly-digest', '0 8 * * 0', ...)`
- **Effort:** 1 session (mostly configuration + email template design)
- **Dependencies:** Resend account, verified sending domain

### Promise Tracker
- **Original scope:** Track government promises, visualise kept/broken/in-progress
- **Why deferred:** Too much editorial judgement required for v1. Screen and navigation deleted in Prompt 2.
- **What exists:** `promises` table (0 rows). Scripts seed file referenced but no data ingested.
- **Effort:** 2-3 sessions
- **Dependencies:** Reliable source of promise data (manual curation)

### Petitions
- **Original scope:** Citizens sign petitions on bills, electorate-scoped
- **Why deferred:** Needs tier-gated verification + politician engagement to have value
- **What exists:** Nothing built
- **Effort:** 3+ sessions
- **Dependencies:** Phone/ID verification, legal review of petition framework

### Council & state expansion
- **Original scope:** Extend Verity beyond federal to cover state parliaments and local councils
- **Why deferred:** Federal-only is a sharper v1. Adding state/council is a data project.
- **What exists:** NSW state parliament data (135 members, 468 bills). Councils table (20 councils, 259 councillors).
- **Effort:** 3+ sessions per jurisdiction
- **Dependencies:** State parliament data sources

### Politician posting layer
- **Original scope:** Verified politicians post official statements via the app
- **Why deferred:** Needs politician onboarding, content moderation, legal review
- **What exists:** Nothing (old `official_posts` system was removed)
- **Effort:** 3+ sessions
- **Dependencies:** Politician engagement program

### Constituent Pulse Dashboard (B2B)
- **Original scope:** Dashboard for politician offices showing constituent sentiment
- **Why deferred:** Post-launch revenue feature
- **What exists:** Nothing built
- **Effort:** 5+ sessions

### Polling trend chart on HomeScreen
- **Original scope:** Replace removed WeeklyPollCard with a "Latest federal polling" headline card showing the published poll aggregate
- **Why deferred:** Requires react-native-svg (not yet installed). Scheduled for Prompt 14.
- **Effort:** Part of Prompt 14 (charts session)

---

## Tech debt

| Item | Severity | Description | Suggested fix |
|------|----------|-------------|---------------|
| ~~`politicians` vs `members` table~~ | ~~HIGH~~ | ~~Resolved in Prompt 4. `politicians` dropped, backed up to `archived.politicians`.~~ | Done |
| ~~`bill_electorate_sentiment`, `donor_influence`, `political_risk`~~ | ~~MEDIUM~~ | ~~Resolved in Prompt 4. Moved to `archived` schema.~~ | Done |
| ~~`digest_log` table~~ | ~~LOW~~ | ~~Resolved in Prompt 4. Dropped (0 rows, no refs).~~ | Done |
| ~~`poll_admin_actions`, `poll_reports`~~ | ~~LOW~~ | ~~Resolved in Prompt 4. Kept — used by AdminPollsScreen.~~ | Done |
| ~~4 Edge Functions without local source~~ | ~~HIGH~~ | ~~Resolved in Prompt 7. All 4 sources recovered via Supabase MCP and saved locally.~~ | Done |
| `revenuecat-webhook` references `"users"` table | HIGH | Deployed function writes to non-existent `users` table (should be `user_preferences`). Fails silently on every webhook call. Non-functional. Needs fix + redeploy, or delete if switching to direct Apple IAP. | Fix table name to `user_preferences` and column to `is_pro`, or delete function entirely |
| `send-push-alerts` references dropped `politicians` table | HIGH | Deployed function queries `politicians` (dropped in Prompt 4) and `user_push_tokens` (doesn't exist — should be `push_tokens`). Also requires APNS secrets not in Vault. Non-functional. Superseded by `send-notification` which uses Expo Push API. | Delete or rewrite. `send-notification` handles the same use case correctly. |
| `email_domain_blocklist` (16 rows) | LOW | Used by verify-phone-send-otp. Keep while phone verification is mothballed. | Leave until phone verification re-enabled. |
| Env var naming inconsistency | LOW | `TVFY_API_KEY` vs `THEYVOTEFORYOU_API_KEY` and `SUPABASE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY` used interchangeably across 40+ scripts. Both work via fallback chains but inconsistent. | Standardize to `THEYVOTEFORYOU_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` everywhere. Mechanical find-replace. |
| NewsScreen vs NewsScreenV2 | MEDIUM | Both exist. NewsScreen used as stack screen, NewsScreenV2 used as tab. Confusing. | Consolidate: rename NewsScreenV2 to NewsScreen, update all references. |
| Personalisation data loading | MEDIUM | `usePersonalRelevance` returns empty `selectedTopics` and `trackedIssues`. Data exists in `user_preferences` but isn't loaded into the hook. | Load from `user_preferences` via Supabase query in the hook. |
| Bold text parsing in daily brief | LOW | Daily brief bullets contain `**bold**` markdown that renders as literal asterisks. | Add a simple `parseBold()` function that splits on `**` and wraps in `<Text fontWeight='700'>`. |
| Electorate-specific news card | LOW | HomeScreen has a placeholder comment for a local news card filtered by electorate tags. `news_stories` doesn't have `electorate_tags` column yet. | Add column to news_stories, populate via ingestion, render card. |
| House of Reps registered interests | LOW | `ingest_registered_interests.py` only covers Senate (API). House interests are PDF-only. Docstring says "Phase 2: House PDF parsing — TODO". | Build a PDF parser for House register. Low priority. |

---

## Post-launch improvements

| Item | Notes |
|------|-------|
| react-native-svg + victory-native polling trend chart | Prompt 14 |
| Sentry integration for crash tracking | Prompt 35 |
| PostHog analytics | Prompt 36 |
| Offline caching layer | Prompt 34 |
| Retry logic with exponential backoff on all hooks | Prompt 34 |
| Server-side poll vote aggregation | Replace client-side `useWeeklyPoll` counting pattern (now deleted, but Daily Question uses similar pattern) |
| FlashList migration | Replace FlatList with FlashList for better perf on long lists |
| Image optimization | Add `contentFit`, `placeholder`, `transition` props to expo-image usage |
| React.memo on list items | EnhancedStoryCard, MemberCard, BillCard — none memoized |
| Lazy loading screens in App.tsx | All 30 screens eagerly imported. Use React.lazy or Navigation `lazy` prop. |

---

## Manual operations (Callum only)

These are not coding tasks. They require Callum's hands or Apple's systems.

| Item | Status |
|------|--------|
| Apple Developer enrollment | Done |
| App Store Connect app creation | Done (ascAppId: 6762104853) |
| EAS environment variables | Done (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY) |
| Supabase Site URL set to verity://auth-callback | Done — verify before submission |
| App Store screenshots (all required sizes) | Not started |
| App Store description, keywords, subtitle | Not started |
| Apple privacy questionnaire | Not started |
| Age rating declaration | Not started |
| Resend account + domain verification (for future email features) | Not started |
| Anthropic API credit top-up | Check balance before submission |
| verity.au domain DNS (for Universal Links, future) | Not configured |
| Legal: retain a media lawyer | Recommended before launch |
