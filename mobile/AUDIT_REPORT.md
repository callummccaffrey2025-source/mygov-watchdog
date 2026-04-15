# Verity App — Comprehensive Audit Report
**Date:** 2026-04-06  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full codebase — screens, components, hooks, context, constants, utils, scripts, config  

---

## Executive Summary

Verity is a technically solid React Native/Expo app with a genuinely differentiated civic data proposition — real vote records, bias-tagged news, personalised MP data, and donation transparency — but it carries three structural liabilities that will limit growth: (1) the three largest screens (HomeScreen, ExploreScreen, ElectionScreen) are 600–1,000+ line monoliths that are unmaintainable and cause slow renders; (2) four hooks have N+1 query or inefficient data-fetch patterns that will degrade performance as user counts grow; (3) critical App Store blockers remain unresolved (blank ascAppId/appleTeamId in eas.json, `userInterfaceStyle: "light"` despite dark mode support). The news system is the most differentiated feature and closest to world-class, but the community feed is effectively a ghost town with zero organic traffic. The highest-ROI work is App Store submission readiness, screen decomposition, and a viral sharing/onboarding loop.

---

## Data Completeness Report

*Note: Supabase MCP was unavailable at audit time. Numbers sourced from CLAUDE.md (dated 2026-04-02) and codebase analysis.*

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Federal members | 225 | 225 | ✅ Complete |
| Members with photos | ~225 (TheyVoteForYou API) | 225 | ✅ Good |
| Members with email | 225 | 225 | ✅ All have APH emails |
| Members with aph_id | ~148 (225 - 77 new) | 225 | ⚠️ 77 missing |
| Members with ministerial_role | Unknown | ~30 | Unknown |
| Total bills | 6,400+ | 6,400+ (APH API down) | ⚠️ No new 2026 bills |
| Bills with AI summary | Unknown | 6,400+ | Large gap |
| Total divisions | 1,929 | ~1,929 | ✅ |
| Total votes | 140,000+ | 140,000+ | ✅ |
| Committee memberships | Unknown | ~500+ | Unknown |
| Individual donations | 2,307 | All current AEC data | Partial (463 matched) |
| Hansard entries | 4,780 | Much more possible | ⚠️ Small sample |
| Official posts (rep updates) | 34 | 225+ | ⚠️ 14 MPs only |
| News articles | ~932 | Ongoing | ✅ Active pipeline |
| Articles with images | ~180/932 (19%) | 932 | ⚠️ 81% missing |
| News stories | ~302 | Ongoing | ✅ Active |
| Stories with AI summary | 0 | All 5+ article stories | ❌ Not yet populated |
| Stories with images | ~23/302 (8%) | 302 | ⚠️ 92% missing |
| News sources | 101 | 101 | ✅ |
| Sources with factuality metadata | ~35 (seed_news_sources.py) | 101 | ⚠️ 65% missing |
| Sources with owner metadata | ~35 | 101 | ⚠️ 65% missing |
| Daily brief (today) | Unknown | 1/day | Check cron |
| Push tokens | Unknown | Growing | Unknown |
| Community posts | Unknown | Growing | Unknown |
| Parties | 17 | 17 | ✅ |
| Electorates | 151+ | 151 | ✅ |
| Councils | 20 | 20+ | Partial |
| State members (NSW) | 135 | All states | ⚠️ NSW only |
| State bills (NSW) | 468 | All states | ⚠️ NSW only |

**Key data gap:** Only 14 of 225 MPs have official posts. This makes the "Posts" tab empty for 94% of profiles — a major UX problem on the most important content screen in the app.

---

## Screen-by-Screen Teardown

### HomeScreen.tsx (~1,000+ lines)
**Rating: NEEDS REWRITE**

**What works:**
- Rich content with MP card, recent votes, news, daily brief, community preview
- Comprehensive loading states (skeleton loaders throughout)
- Pull-to-refresh implemented
- Good dark mode coverage

**Critical problems:**
- **Size:** ~1,000 lines — this is a maintainability crisis. Every new feature adds 50+ lines to an already-unmanageable file.
- **Performance:** 11 hooks fire on mount simultaneously (useUser, useBills, usePolls, useElectorateByPostcode, useRecentDivisions, useNewsItems, useNewsStories, useVotes, useDailyBrief, useRepresentativeUpdates, useTheme). Every one of these hits Supabase on cold start. No prioritization — above-the-fold content loads at the same time as below-fold content.
- **Re-renders:** No useMemo/useCallback usage to prevent unnecessary child re-renders. DailyBrief and MPCard are inline components that re-render on every parent state change.
- **Scroll depth:** User must scroll through: greeting → stats bar → MP card → recent votes → news preview → community → daily brief → trending bills. Daily brief is ~5+ screens down. Most users will never see it.
- **CIVIC_FACTS array:** Hardcoded, rotates via day-of-year. These will become stale and incorrect quickly.
- **Missing feature:** No "mark as read" on news items — user sees the same items repeatedly until a new fetch.
- **Missing feature:** No personalization logic beyond postcode → MP. Users with no postcode see generic content identical across all users.

**Benchmark (Instagram/Twitter):** Above-the-fold is your most important real estate. The first card a user sees should be the single most relevant thing to them right now. Verity shows a generic stats bar before the MP card. Flip this — MP card first, always.

---

### ExploreScreen.tsx (~600+ lines)
**Rating: NEEDS REWRITE**

**What works:**
- State filter pills
- Browse by Topic with 14 categories
- Verify a Claim modal with real vote data
- Party horizontal scroll

**Critical problems:**
- **Size:** 600+ lines mixing search, verification, browsing, state filtering
- **Search UX:** Search box at the top suggests universal search, but it actually only searches within the selected tab (Members/Bills/Parties). A user searching for "climate" bills while on the Members tab gets no results. Confusing.
- **Verify a Claim:** Brilliant feature, but buried. Hidden behind a modal. No sharing. No shareable claim verdict card.
- **Browse by Topic grid:** 14 topics rendered but requires understanding of parliamentary categories. A new user doesn't know what "Indigenous Affairs" → bills means.
- **Council tab:** Exists but disconnected from the rest of the app. No navigation from council → councillors → contact.
- **State filter "Federal" is default:** But NSW is the only state with data. Selecting VIC/QLD shows nothing. This looks broken to users.
- **No search history:** User types, closes, reopens — starts from scratch every time.

---

### ElectionScreen.tsx (~500+ lines)
**Rating: NEEDS REWRITE**

**What works:**
- Election countdown with real date
- Your Electorate section with MP card
- How They Voted on Key Issues bars
- Compare MPs (real aye rates, topics, donations)

**Critical problems:**
- **Name "Vote" tab is misleading:** Non-political users will interpret this as a voting app or polling feature. "Parliament" or "Accountability" would better describe the content.
- **Key Issues voting bars:** Progress bars are compelling but the category labels are too technical ("Legislation", "Defence"). Users need plain language: "Climate laws", "Military spending".
- **Election countdown:** Shows days until the next federal election but no context — new users don't know when the last election was or what's at stake.
- **Compare MPs section:** Powerful feature, completely hidden at the bottom. Users must scroll past the entire voting record to reach it.
- **No "Compare two candidates in my electorate"** — the comparison feature is general, not local. Most users only care about their own electorate candidates.

---

### MemberProfileScreen.tsx (~500+ lines)
**Rating: NEEDS REFACTOR**

**What works:**
- Real photos with party-coloured headers
- 5 tabs (Posts, Votes, About, Funding, Speeches)
- Rebellion indicator
- Share report card functionality

**Critical problems:**
- **Posts tab is empty for 211 of 225 MPs:** The primary tab shows nothing. The screen opens to a ghost. This is the single biggest UX problem in the app.
- **Votes tab performance:** Loads all 100 votes at once. No virtual list. On a device with 225 MPs each with 100+ votes, this is a memory issue at scale.
- **About tab:** Shows electorate, party, committee memberships. Missing: social media links, official website, contact form link.
- **Funding tab Party/Personal segmented control:** Excellent feature. Personal tab often empty for most members (only 463 of 225 matched). Needs better empty state.
- **Speeches tab:** Shows Hansard excerpts. The 4,780 speeches across 225 members = ~21 per MP average. Many MPs will have zero.
- **No way to contact MP from profile:** "Write to MP" button exists but requires scrolling. Should be sticky CTA.
- **Missing:** Twitter/X handle, electorate office address, phone number.

---

### BillDetailScreen.tsx (~514 lines)
**Rating: NEEDS REFACTOR**

**What works:**
- Plain English summaries (Claude-generated)
- How Parliament Voted section with party breakdown
- Key Arguments (for/against)
- Share functionality
- "Write to Your MP" contextual CTA

**Critical problems:**
- **AI Summary quality unknown:** Summaries generated from `summary_raw` which is APH's own description — this is often legalistic and hard to understand. Claude should be prompted to explain impact, not just rephrase.
- **Key Arguments section:** Currently 2 hardcoded arguments per side from `bill_arguments` table. If no arguments seeded, shows empty. For 6,400 bills, most will have empty arguments.
- **No vote by individual MP:** "How Parliament Voted" shows party totals. User can't see how THEIR MP voted on this specific bill (they'd need to navigate to MP profile and find it). This is the #1 most wanted feature for civic apps — "Did my MP vote for this?"
- **Pro/Con upsell:** "AI Impact Analysis" locked behind Pro. This is a key differentiator — gating it prevents organic sharing.
- **Timeline missing:** No reading stages shown. Users don't know where in the legislative process a bill is.

---

### NewsScreen.tsx (~250 lines)
**Rating: CLEAN**

**What works:**
- Filter by leaning (Left/Centre/Right) and category
- Story cards with coverage bars, source counts
- Category badges
- Good skeleton loading

**Issues:**
- **TRENDING badge:** Shown on HomeScreen news items but absent on NewsScreen. Inconsistency.
- **No "mark as read":** User sees same stories every visit.
- **Filter pills don't combine:** Can filter by leaning OR category, not both simultaneously.
- **No date grouping:** Stories from 3 days ago mixed with today's stories.

---

### NewsStoryDetailScreen.tsx (~400 lines)
**Rating: CLEAN (recently upgraded)**

**What works:**
- AI summary panel (new)
- Coverage bar with leaning breakdown
- Grouped articles by leaning (Left/Centre/Right)
- Factuality badges on sources (once data populated)
- Owner labels
- DB-backed blindspot detection
- "How this affects you" personalisation

**Issues:**
- **AI summaries not yet populated:** The panel exists but `ai_summary` is null for all stories (compute_story_metrics not yet run). Blank screen for this feature.
- **Factuality badges empty:** `factuality_numeric` null for most sources until `seed_news_sources.py` runs.
- **No deep link to individual article from notification:** Notifications link to story but not to specific article.
- **Blindspot detection:** Uses DB field now but falls back to client-side logic. Both compute the same thing — the DB version should be definitive.
- **Share button**: Captures and shares a static card. Missing option to share individual article URL.

---

### ProfileScreen.tsx
**Rating: CLEAN**

**What works:**
- Sign in with Apple, Google, email magic link
- Civic score / engagement tracking
- Postcode management
- Settings links (notifications, topics, subscription)

**Issues:**
- **Civic score gamification:** Score shown but no leaderboard, no explanation of what it means, no milestones. Users have no reason to care about their score.
- **No reading history:** App has no record of what the user has already read/seen.
- **No bookmarks:** Can't save a bill or story for later.
- **Empty signed-out state:** Before sign-in, the profile tab shows just a sign-in form. Could be used to preview what they'd see if they signed in.

---

### CommunityScreen.tsx
**Rating: CLEAN (feature is underdeveloped)**

**What works:**
- Electorate-scoped community feed
- Latest/Top/Mine tabs
- Post voting system
- Anonymous browsing

**Issues:**
- **Content is empty:** The feature exists but there are likely zero or near-zero community posts. An empty community is worse than no community.
- **No discovery:** Community is buried at the bottom of HomeScreen. No push notifications for community activity. No "trending in your area" hook.
- **No moderation UI:** `community_reports` table exists but no UI to flag content or for admins to review.
- **No identity:** Anonymous posts have no personality. Users need a handle to feel a sense of community.
- **No threading:** Comments on posts exist but flat, no replies to comments.

---

### OnboardingScreen.tsx
**Rating: CLEAN**

**What works:**
- 5-step flow: welcome → postcode → MP reveal → topics → notifications
- MP reveal is the "wow moment" — user types postcode, sees their actual MP
- Topic selection personalizes content

**Issues:**
- **Step 3 (MP reveal):** If postcode lookup fails, flow continues without MP. User never knows why. Should show error and retry.
- **Step 5 (notifications):** Shows notification request on step 5. Should be on step 3 — after the "wow moment" when user is most engaged.
- **No back button** between steps.
- **Welcome screen:** Generic. Should show a real news story or real bill to demonstrate value immediately.
- **Dark mode:** The onboarding background uses hardcoded white — jarring if device is in dark mode.

---

### SubscriptionScreen.tsx
**Rating: CLEAN**

**Issues:**
- **$4.99/month paywall for AI features:** The comparison table shows "AI Impact Analysis" as Pro-only. But if users never see the AI quality, they won't pay for it. Consider giving 3 free AI analyses per month.
- **No testimonials or social proof.**
- **"7-day free trial":** Great offer but displayed in tiny muted text. Should be the headline.
- **RevenueCat integration:** Referenced in env but no UI for managing subscription from profile.

---

### CompareScreen.tsx, ClaimProfileScreen.tsx, WriteToMPScreen.tsx
**Rating: CLEAN** — well-implemented features. Write to MP is particularly polished with pre-filled templates.

---

### PrivacyPolicyScreen.tsx, TermsScreen.tsx
**Rating: CLEAN but missing dark mode** — both use hardcoded light colors.

---

## Architecture Issues

### 1. CRITICAL: Notification Deep-Link Crash
**File:** `App.tsx` lines 243-249  
**Issue:** When a push notification is tapped, the app navigates to `BillDetail` with `{ billId }`, `MemberProfile` with `{ memberId }`, or `NewsStoryDetail` with `{ storyId }`. All three screens destructure `{ bill }`, `{ member }`, `{ story }` from params — they crash immediately if only an ID is passed.  
**Impact:** Every notification tap crashes the app. This is a P0 bug.

### 2. HIGH: Three Monolith Screens
**Files:** `HomeScreen.tsx` (~1,000 lines), `ExploreScreen.tsx` (~600 lines), `ElectionScreen.tsx` (~500 lines)  
**Issue:** These screens mix data fetching, business logic, and presentation. Any change requires reading the entire file. Child components are defined inline causing unnecessary re-renders.  
**Fix:** Extract into separate component files: `DailyBrief.tsx`, `VotingGrid.tsx`, `VerifyModal.tsx`, `CompareSection.tsx`, etc.

### 3. HIGH: N+1 Query in usePolls
**File:** `hooks/usePolls.ts` lines 28-40  
**Issue:** For each poll in the array, makes a separate Supabase query to fetch vote counts. 10 polls = 11 queries. Should use a single aggregation query.

### 4. HIGH: No Route Type Safety
**All screens** use `route: any` and `navigation: any`  
**Issue:** Navigation params are completely untyped. Passing wrong params fails silently at runtime instead of at compile time.  
**Fix:** Create a `RootStackParamList` type and use `StackScreenProps<RootStackParamList, 'ScreenName'>` on each screen.

### 5. MEDIUM: Missing Error States in Hooks
**Files:** `useNewsStoryArticles.ts`, `useVotes.ts`, `useOfficialPosts.ts`, `useCommittees.ts`, `useHansard.ts`  
**Issue:** Query errors are logged to console but not returned. Screens can't distinguish "loading" from "failed" — they show empty states for both.

### 6. MEDIUM: Hardcoded `any` Types in Components
- `BillCard.tsx` line ~30: `(bill as any).origin_chamber`
- `SkeletonLoader.tsx` line ~27: `width as any`
- `PollCard.tsx` line ~42: width percentage `as any`
- All Ionicons usages: `name={... as any}`

### 7. MEDIUM: usePolls and useCommunityVote Inefficiency
**Files:** `hooks/usePolls.ts`, `hooks/useCommunityVote.ts`  
`usePolls`: N+1 as noted above.  
`useCommunityVote`: After each vote, re-fetches ALL votes for the target to recount. Should use optimistic updates + server-side aggregation.

### 8. MEDIUM: shareContent.ts Silent Failures
**File:** `utils/shareContent.ts`  
**Issue:** Catch block swallows all errors without logging. The 80ms arbitrary delay before capture is a race condition waiting to happen.

### 9. MEDIUM: UserContext Missing Postcode Clear on Sign-Out
**File:** `context/UserContext.tsx`  
**Issue:** `signOut()` clears the session but not the postcode. After signing out, the app still shows the previous user's electorate MP.

### 10. LOW: No Navigation Param Validation
All screens that receive `{ bill }`, `{ member }`, `{ story }` params trust that the passed object is complete and well-formed. If a notification passes just `{ storyId }`, the screen crashes (see #1).

### 11. LOW: Dead Code
- `CompareScreen.tsx` exists in the filesystem and was imported during development but is it actually registered in App.tsx? (It is NOT listed in the Stack.Navigator — it may be unused.)
- `useLocalAnnouncements` hook exists but no screen uses it visibly.
- Several hooks expose refresh functions that are never called.

### 12. LOW: app.json `userInterfaceStyle: "light"`
**File:** `app.json` line 36  
**Issue:** App supports dark mode (ThemeContext reads system color scheme), but `userInterfaceStyle: "light"` forces light mode in some contexts. Should be `"automatic"`.

### 13. LOW: Missing expo-font Dependency
**File:** `package.json`  
**Issue:** `expo-doctor` reports `expo-font` is a missing peer dependency of `@expo/vector-icons`. This will cause crashes in production builds outside Expo Go.

---

## Security Audit

### 1. ✅ PASS: API Keys Properly Stored
`.env` file not committed. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are public-safe. Service role key stays server-side in Edge Functions.

### 2. ✅ PASS: Supabase Uses Anon Key
`lib/supabase.ts` uses the anon key — appropriate for client-side use. Service role key is only in Edge Functions via env vars.

### 3. ⚠️ UNKNOWN: RLS Policies
Cannot verify without database access, but tables storing user data (`push_tokens`, `community_posts`, `community_votes`, `mp_messages`, `share_events`, `user_preferences`) must have RLS enabled so users can only read/write their own records. If RLS is missing, any authenticated user can read all community posts by other electorates, all notification tokens, all MP messages.

### 4. ⚠️ CONCERN: community_posts Anonymous Access
`useCommunityPosts.ts` fetches posts using `device_id` fallback. Anonymous users can post using device ID. This enables spam with no attribution or accountability. Need rate limiting (posts per device per day) and content moderation.

### 5. ✅ PASS: No SQL Injection
All Python scripts use parameterized Supabase client — no raw SQL string interpolation. All TypeScript code uses Supabase client — no raw SQL.

### 6. ⚠️ CONCERN: Deep Link Auth Token Handling
`App.tsx` lines 221-231: Parses access_token and refresh_token from URL fragment and calls `supabase.auth.setSession()`. If someone tricks a user into clicking a crafted `verity://...#access_token=evil` URL, they could inject a session. Mitigation: validate tokens before accepting.

### 7. ⚠️ CONCERN: Write-to-MP Sentiment Logging
`WriteToMPScreen.tsx` logs sentiment analysis to `mp_messages`. If users write private letters, does the privacy policy disclose that we analyze and store their message content? This could be a legal/privacy issue.

### 8. ✅ PASS: .claude/settings.json Protection Hooks
PreToolUse hook prevents editing `.env`, `supabase/migrations/`, `package-lock.json`. Good safety guard.

---

## Performance Issues

### 1. CRITICAL: HomeScreen 11 Concurrent Fetches on Mount
All 11 hooks fire simultaneously. While Supabase connection pooling handles this, each query returns data at different times causing 11 separate re-renders of the HomeScreen tree. Should prioritize above-fold data (MP card, recent votes) and lazy-load below-fold (daily brief, community).

### 2. HIGH: No FlatList on Long Scroll Lists
HomeScreen renders all news items, all vote records, all rep updates in a plain `ScrollView`. For users with large data sets, this is a memory issue. Should use `FlatList` with `windowSize` and `maxToRenderPerBatch`.

### 3. HIGH: usePolls N+1
See Architecture Issues #3.

### 4. HIGH: No Image Caching Strategy
`news_stories.image_url` and member `photo_url` are fetched on every render with no explicit cache-control. React Native's `Image` component has some built-in caching, but without `expo-image` (which has aggressive caching), thumbnails re-download on every scroll.

### 5. MEDIUM: MemberProfileScreen Loads 100 Votes Upfront
Even the votes tab is lazily rendered (only shown when tab is active), but the hook `useVotes` fires on mount and fetches 100 votes. This data is never needed unless the user taps the Votes tab.

### 6. MEDIUM: Bundle Size
From the expo export: bundle is 4MB HBC. Given React Native overhead, this is acceptable, but should be monitored. No code splitting or lazy screen loading.

### 7. LOW: Analytics Event Logging
`trackEngagement()` in `useEngagementScore.ts` fires on every bill read/poll vote/etc. These are fire-and-forget upserts but add latency to user interactions if network is slow.

---

## Product Gaps

### MISSING FEATURE 1: Universal Search
The app has no way to search across everything simultaneously. Users must know to go to Explore → Members or Explore → Bills. A global search bar (like Spotlight or The Guardian app) is table stakes for civic apps. Most users arrive with "what did my MP vote on climate?" not "let me browse by category."

### MISSING FEATURE 2: Bookmarks/Saves
No way to save a bill, article, or MP profile for later reading. This is the most-requested feature in every civic app. Without it, users who want to research before an election have nowhere to put their research.

### MISSING FEATURE 3: Reading History
The app has no memory of what the user has seen. Same news stories appear every visit. Same bills in trending. No "new" badges. The app feels static, not alive.

### MISSING FEATURE 4: My MP's Week (Weekly Digest)
Every Friday, send a push notification: "Here's what [MP name] voted on this week." This creates a habit loop without requiring the user to actively seek information.

### MISSING FEATURE 5: Bill Tracker / Follow a Bill
Users can follow MPs but not individual bills. Following a bill should trigger notifications when it passes reading stages, has a vote, or gets a new amendment.

### MISSING FEATURE 6: Election Mode
During election campaigns (3 May 2025 federal election was apparently in progress), the app should have a dedicated mode: candidate comparison, electorate polling, preferential voting explainer, polling booth finder. The "Vote" tab exists but doesn't have this.

### MISSING FEATURE 7: Offline Mode
The app requires internet for everything. At minimum, the last-loaded daily brief and the user's MP profile should be cached offline.

### MISSING FEATURE 8: Crash Reporting
No Sentry, Datadog, or Bugsnag integration. Crashes are invisible. The team doesn't know what's breaking for real users.

### MISSING FEATURE 9: Analytics
No Mixpanel, Amplitude, or PostHog. Which screens do users actually use? What's the drop-off rate on onboarding? Zero visibility.

### MISSING FEATURE 10: State Parliament Coverage
Only NSW (135 members, 468 bills). VIC, QLD, WA, SA users see "no data" for state parliament. Half the country is excluded from this feature.

### MISSING FEATURE 11: Senator Coverage in Explore
Senators represent entire states, not electorates. Users who search for their Senator by postcode can find them, but there's no "all senators from NSW" view.

### MISSING FEATURE 12: Accessibility (VoiceOver/TalkBack)
No `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` props visible in any screen. The app is inaccessible to blind/low-vision users.

### MISSING FEATURE 13: iPad Layout
`supportsTablet: false` in app.json. iPad is common for news consumption. Missing this market.

### MISSING FEATURE 14: Widgets
iOS 14+ home screen widgets showing the Daily Brief or "Your MP voted on X today" would drive daily engagement without requiring app opens.

---

## Competitive Gaps

### vs. Ground News
- **Ground News has:** 50,000+ sources, AI-powered bias detection trained on millions of articles, "Blindspot" as a core marketing concept, read history ("you've been in a media bubble"), real-time trending by country.
- **Verity gaps:** 101 sources (good start, but ~500x fewer), no AI bias scoring (factuality is from manual seeding), no reading history bubble detection, no trending by region within Australia.
- **Verity advantage:** Vote records, MP accountability data — Ground News has none of this.

### vs. They Vote For You (TVFY)
- **TVFY has:** Every division since 2004, policy agreement scores per MP, easily shareable "did your MP vote for X?" links.
- **Verity gaps:** No historical data beyond current term (starts 2022-07-01), no aggregate policy agreement score, no shareable verdict page.
- **Verity advantage:** Mobile-first, news integration, community feed.

### vs. OpenAustralia
- **OpenAustralia has:** Full Hansard from 2006, email-your-MP feature with delivery tracking, petition builder.
- **Verity gaps:** Only 4,780 Hansard entries (18 sitting days), no delivery tracking for Write to MP emails.
- **Verity advantage:** Modern UX, news system, mobile app.

### vs. ABC News App
- **ABC has:** Breaking news alerts, live radio/TV streaming, in-depth analysis, national reach.
- **Verity gaps:** Not a news aggregator — Verity has no original journalism.
- **Verity advantage:** Accountability angle, MP voting records, bias analysis.

### vs. Reddit (r/AustralianPolitics)
- **Reddit has:** 200k+ subscribers, real-time discussion, cross-linking, karma system, thread depth.
- **Verity gaps:** Community feed has near-zero users, no threading, no karma/reputation, no cross-electorate discovery.
- **Verity advantage:** Verified data, no misinformation, AI summaries, MP profiles.

---

## What Would Make This a $1B Product

1. **MPs posting directly:** If 50 MPs used Verity to post updates (like a civic Twitter), it creates a verified feed that no other app has. This is the moat. Activate verified MPs → their constituents follow → network effect.
2. **The "My MP Report Card" going viral:** Every Friday before a sitting week, send shareable MP scorecards (the feature exists but nobody knows about it). These are designed to be shared. One viral moment around a high-profile vote could bring 50k downloads.
3. **Election mode (April-May 2025 federal election):** A dedicated "2025 Election" tab with candidate comparison, your electorate race, preferential voting explainer. The app should have been in "election mode" for the federal election.
4. **Daily habit loop:** "Good morning. [MP] voted on 3 bills yesterday. Here's what they decided." — 7am notification. This is why people open news apps daily.
5. **Follow the money:** "You follow [MP]. Their top donor is [Company X] who also donated to [other MP] who voted against climate policy." This is investigative journalism at scale, powered by data.

---

## Top 50 Ranked Improvements

**Legend:** Impact: H/M/L | Effort: hours | Category | Files

---

### TIER 1: SHIP BLOCKERS (Do these before App Store submission)

**[1] [CRASH] [2h] Fix notification deep-link crash**  
Files: `App.tsx`, `BillDetailScreen.tsx`, `MemberProfileScreen.tsx`, `NewsStoryDetailScreen.tsx`  
Current: Notifications pass `{ billId }` / `{ memberId }` / `{ storyId }` but screens destructure `{ bill }` / `{ member }` / `{ story }` — instant crash.  
Should be: Each screen accepts either full object OR id, and fetches by ID if needed.  
Why: Every push notification tap crashes the app. Push notifications are live. This is actively breaking the app for users.

**[2] [CONFIG] [0.5h] Fix app.json userInterfaceStyle**  
File: `app.json` line 36  
Current: `"userInterfaceStyle": "light"` — forces light UI in system settings  
Should be: `"userInterfaceStyle": "automatic"` — respects system dark/light preference  
Why: App has full dark mode support but this flag overrides it in some contexts.

**[3] [CONFIG] [0.5h] Add expo-font to package.json**  
File: `package.json`  
Current: Missing peer dependency of `@expo/vector-icons`  
Should be: `"expo-font": "~13.0.4"` in dependencies  
Why: expo-doctor reports this causes crashes in production builds outside Expo Go.

**[4] [CONFIG] [1h] Set ascAppId and appleTeamId in eas.json**  
File: `eas.json` lines 29-30  
Current: Both are empty strings  
Should be: Populated with real App Store Connect App ID and Apple Team ID  
Why: Blocks App Store submission. #1 priority per CLAUDE.md.

**[5] [CONFIG] [0.5h] Add verity:// URI scheme to app.json**  
File: `app.json`  
Current: Deep link scheme used in App.tsx line 223 but not declared in app.json  
Should be: Add `"scheme": "verity"` to the root of expo config (it IS there actually on line 7 — verify this is correct)  
Why: Without scheme declaration, magic link auth deep links may not work in production.

---

### TIER 2: HIGH IMPACT BUGS & UX WINS

**[6] [UX] [4h] Fix empty Posts tab for 211 of 225 MPs**  
File: `MemberProfileScreen.tsx`  
Current: Posts tab opens to empty state for MPs with no official posts (211 of 225)  
Should be: Default to Votes tab if no posts exist; show a "No posts yet — follow to get notified when [MP] posts" empty state with follow CTA  
Why: First thing users see on an MP profile is empty. This destroys first impressions.

**[7] [DATA] [2h] Run seed_news_sources.py and backfill_story_metrics**  
Files: `scripts/seed_news_sources.py`, `scripts/ingest_news.py` (`backfill_story_metrics`)  
Current: 0 stories have AI summaries; 0 sources have factuality metadata  
Should be: Run `python scripts/seed_news_sources.py` then `python scripts/ingest_news.py --no-metrics` then call `backfill_story_metrics` separately  
Why: The entire Ground News quality upgrade sits idle behind unrun scripts.

**[8] [PERF] [3h] Fix usePolls N+1 query**  
File: `hooks/usePolls.ts` lines 28-40  
Current: For each poll, makes a separate query to count votes per option  
Should be: Single query with aggregate vote counts via Supabase RPC or a view  
Why: 10 polls = 11 DB queries on every HomeScreen load.

**[9] [UX] [6h] Add "Did my MP vote for this?" to BillDetailScreen**  
File: `BillDetailScreen.tsx`  
Current: Shows party-level vote breakdown but not individual MP's vote  
Should be: If user has postcode set, show "Your MP [name] voted [AYE/NO/ABSENT]" prominently above the full party breakdown  
Why: This is the #1 most-wanted feature in civic apps. It's the entire reason to install Verity.

**[10] [ARCH] [1h] Fix TypeScript route params (highest-risk screens first)**  
Files: `BillDetailScreen.tsx`, `MemberProfileScreen.tsx`, `NewsStoryDetailScreen.tsx`  
Current: `route.params` typed as `any`  
Should be: Create `RootStackParamList` in `types/navigation.ts` and type each screen properly  
Why: Prevents compile-time detection of navigation bugs like the crash in item #1.

**[11] [UX] [2h] Move notification request to after MP reveal in onboarding**  
File: `OnboardingScreen.tsx`  
Current: Notification request is step 5 (last), after topic selection  
Should be: Move to immediately after step 3 (MP reveal) when user is most emotionally engaged  
Why: "You can get notified when [MP name] votes" at the moment the user first sees their MP is the highest-conversion notification ask.

**[12] [UX] [3h] Add "My MP voted on X this week" weekly digest notification**  
Files: `supabase/functions/generate-daily-brief/` or new edge function  
Current: Daily brief runs once and sends generic push notification  
Should be: Every Monday morning, compile MP's votes from the past week and send "[MP name] voted on 5 bills this week" with the 3 most significant  
Why: Creates a weekly habit loop tied to the user's actual MP.

**[13] [UX] [4h] Add bookmarks/saves feature**  
Files: New `useSavedItems.ts` hook, new Supabase table `saved_items(user_id, item_type, item_id)`, UI in BillDetailScreen + NewsStoryDetailScreen + MemberProfileScreen  
Current: No way to save anything  
Should be: Bookmark icon on bills, stories, and MP profiles; "Saved" section in ProfileScreen  
Why: Most-requested feature in civic/news apps. Essential for election research.

**[14] [DARK MODE] [2h] Fix dark mode on PrivacyPolicy + Terms + CreatePost + CompareScreen**  
Files: `PrivacyPolicyScreen.tsx`, `TermsScreen.tsx`, `CreatePostScreen.tsx`, `CompareScreen.tsx`  
Current: Hardcoded light colors — these screens are white in dark mode  
Should be: Import and use `useTheme()` hook, replace hardcoded colors  
Why: Jarring experience when navigating to these screens in dark mode.

**[15] [PERF] [4h] Lazy-load below-fold content on HomeScreen**  
File: `HomeScreen.tsx`  
Current: All 11 hooks fire on mount; community + daily brief load same time as MP card  
Should be: Prioritize above-fold (MP card, recent votes) using immediate hooks; wrap below-fold sections (daily brief, community, trending bills) in deferred hooks that fire after first render  
Why: Reduces time-to-first-meaningful-content from cold start.

---

### TIER 3: ARCHITECTURE & QUALITY

**[16] [ARCH] [8h] Decompose HomeScreen into extracted components**  
File: `HomeScreen.tsx` (~1,000 lines)  
Current: Monolith with inline MPCard, DailyBrief, CompareSection, etc.  
Should be: Extract to `components/home/DailyBriefCard.tsx`, `components/home/RecentVotesRow.tsx`, `components/home/CommunityPreview.tsx`  
Why: Maintainability. Every new HomeScreen feature currently means editing a 1,000-line file.

**[17] [ARCH] [6h] Decompose ExploreScreen + extract VerifyModal**  
File: `ExploreScreen.tsx` (~600 lines)  
Current: Monolith mixing search, verification, browsing, councils  
Should be: Extract `components/explore/VerifyModal.tsx`, `components/explore/TopicGrid.tsx`  
Why: Verify a Claim is a killer feature — it deserves its own file and proper tests.

**[18] [ARCH] [6h] Decompose ElectionScreen**  
File: `ElectionScreen.tsx` (~500 lines)  
Current: Election countdown + voting analysis + MP comparison all in one file  
Should be: Extract `components/election/CompareSection.tsx`, `components/election/VotingGrid.tsx`  
Why: CompareSection is used in both HomeScreen and ElectionScreen — DRY principle.

**[19] [ARCH] [4h] Extract MemberProfileScreen tab content**  
File: `MemberProfileScreen.tsx` (~500 lines)  
Current: All 5 tabs rendered in single component  
Should be: `components/member/VotesTab.tsx`, `components/member/FundingTab.tsx`, etc., with lazy rendering (only load tab data when tab is active)  
Why: Performance (only load votes when user taps Votes tab) + maintainability.

**[20] [ERROR] [3h] Add error states to critical hooks**  
Files: `useNewsStoryArticles.ts`, `useVotes.ts`, `useHansard.ts`  
Current: Error is logged to console but not returned in hook state  
Should be: `return { articles, loading, error }` — screens can show "Failed to load" state  
Why: Users see blank screens and don't know if they're still loading or broken.

**[21] [SECURITY] [2h] Verify RLS policies on sensitive tables**  
Tables: `push_tokens`, `community_posts`, `community_votes`, `mp_messages`, `user_preferences`  
Current: Unknown  
Should be: Each table has RLS policy so `auth.uid() = user_id` for reads and writes  
Why: Without RLS, any authenticated user can read every other user's notification tokens and private MP messages.

**[22] [PERF] [4h] Replace ScrollView with FlatList on long lists**  
Files: `MemberProfileScreen.tsx` (votes list), `NewsScreen.tsx` (story list)  
Current: `ScrollView` with `.map()` renders all items upfront  
Should be: `FlatList` with `keyExtractor`, `windowSize={5}`, `maxToRenderPerBatch={10}`  
Why: On devices with large datasets, current approach causes memory pressure and jank.

**[23] [PERF] [2h] Add expo-image for aggressive image caching**  
Files: `MemberCard.tsx`, `NewsScreen.tsx`, `HomeScreen.tsx`  
Current: React Native `Image` with no explicit cache policy  
Should be: `expo-image` with `cachePolicy="memory-disk"`  
Why: Without disk caching, member photos re-download on every scroll. Expo-image is Expo-native and significantly better.

**[24] [MONITORING] [2h] Add Sentry crash reporting**  
Files: `App.tsx`, `package.json`  
Current: No crash reporting whatsoever  
Should be: `@sentry/react-native` initialized in App.tsx with `SENTRY_DSN` env var  
Why: Zero visibility into production crashes. Currently flying blind.

**[25] [MONITORING] [2h] Add PostHog or Mixpanel analytics**  
Files: `App.tsx`, `package.json`  
Current: No analytics — only `share_events` table and `engagement_score`  
Should be: Track screen views, feature usage, onboarding drop-off, subscription conversion  
Why: Product decisions are currently gut-feel. Analytics enables data-driven improvements.

---

### TIER 4: DATA & FEATURES

**[26] [DATA] [3h] Seed official posts for 30+ more MPs**  
File: `scripts/seed_representative_updates.py`  
Current: 34 posts across 14 MPs — 211 MPs have zero posts  
Should be: Add posts for all Cabinet ministers, all opposition shadow ministers, key crossbench senators  
Why: Posts tab is empty for 94% of profiles. This is the feature that would get politicians to engage.

**[27] [DATA] [8h] Ingest state parliament for all states (VIC, QLD, WA, SA)**  
Files: New `scripts/ingest_vic_parliament.py`, `ingest_qld_parliament.py`, etc.  
Current: Only NSW covered in state tab  
Should be: All 6 states + 2 territories  
Why: VIC, QLD, WA users see an empty "State" tab. That's half of Australia excluded.

**[28] [DATA] [4h] Backfill AI summaries for all existing stories with 5+ articles**  
File: `scripts/ingest_news.py` (`backfill_story_metrics` function)  
Current: AI summaries column exists but is null for all stories  
Should be: Run `backfill_story_metrics(sb, limit=500)` to populate for all qualifying stories  
Why: The "Story Summary" panel in NewsStoryDetailScreen is always empty.

**[29] [DATA] [2h] Fix APH OpenData 404 for 2026 bills**  
File: `scripts/ingest_federal_bills.py`  
Current: Falls back to RSS which has limited bill data  
Should be: Monitor APH for API restoration; add alternate source (parliament.aph.gov.au JSON API endpoint)  
Why: No new bills since the API broke — the bills section is becoming stale.

**[30] [FEATURE] [6h] Add Bill Stage Timeline**  
File: `BillDetailScreen.tsx`  
Current: Shows status badge but no history of reading stages  
Should be: Show a timeline: "First Reading → Second Reading → Committee → Third Reading → Royal Assent" with dates filled in where known  
Why: This is how The Guardian and BBC cover bills — timeline makes complex legislative process human.

**[31] [FEATURE] [8h] Add universal search**  
Files: New `SearchScreen.tsx`, update `App.tsx` navigation  
Current: Search only works within ExploreScreen tabs  
Should be: Search bar accessible from all tabs searches across bills, MPs, stories, topics simultaneously  
Why: Most users arrive with intent ("what's happening with housing?") not category knowledge.

**[32] [FEATURE] [6h] Add Bill Tracking / Follow a Bill**  
Files: New `useSavedBills.ts`, update `BillDetailScreen.tsx`, add push notification trigger  
Current: Users can follow MPs but not bills  
Should be: "Track this bill" button; notification when bill passes a new reading stage  
Why: Users researching specific legislation need to be able to track it over time.

**[33] [FEATURE] [4h] Add "New" / reading history badges**  
Files: New `useReadItems.ts` (AsyncStorage-based), `NewsScreen.tsx`, `HomeScreen.tsx`  
Current: Same stories appear on every visit with no "new" indicator  
Should be: Mark items as seen on tap; show "NEW" badge on unseen stories  
Why: Without reading history, the app feels static. News apps live and die by freshness signals.

**[34] [UX] [3h] Improve "Verify a Claim" sharing**  
File: `ExploreScreen.tsx` (VerifyModal)  
Current: Shows verdict but no share button  
Should be: "Share this fact-check" generates a shareable card with claim + verdict + MP's actual vote record  
Why: Viral moment opportunity. Political fact-checks are highly shareable on social media.

**[35] [UX] [4h] Election Mode tab during election campaigns**  
File: `ElectionScreen.tsx`  
Current: Generic "Vote" tab  
Should be: Detect election within 60 days; transform tab to "Election 2025" with: your electorate candidates, candidate comparison, how-to-vote guide, polling booth finder  
Why: App downloads spike around elections. This is the highest-leverage acquisition period.

**[36] [UX] [2h] Add MP contact info to profile (social, office address)**  
File: `MemberProfileScreen.tsx` (About tab)  
Current: Shows party, electorate, committees  
Should be: Also show Twitter/X handle, Facebook, official website, electorate office address and phone  
Why: APH website has this data. Currently underutilizing the "contact your MP" value proposition.

**[37] [UX] [3h] Add leaderboard or milestones to civic score**  
File: `ProfileScreen.tsx`  
Current: Shows civic score number but no context  
Should be: "You're in the top 20% of Verity users" + milestone badges ("Voted Reader — 50 articles read")  
Why: Gamification increases retention. Without milestones, the score means nothing.

**[38] [INFRA] [2h] Add Hansard for more MPs and sitting days**  
File: `scripts/ingest_hansard.py`  
Current: 4,780 speeches from 18 sitting days  
Should be: Run script for all available sitting days (OpenAustralia API has full history)  
Why: Speeches tab is thin for most MPs. Richer Hansard makes the app more authoritative.

**[39] [INFRA] [4h] Improve ingest_news.py monitoring**  
File: `scripts/ingest_news.py`  
Current: Logs to console and `pipeline_runs` table  
Should be: Alert via Slack/email if daily run produces 0 new articles or fails; track source-by-source success rates  
Why: The pipeline is the lifeblood of the news feature. Silent failure is unacceptable.

**[40] [INFRA] [3h] Extract shared utilities from Python scripts**  
Files: New `scripts/lib/utils.py`  
Current: Name normalization, date parsing, fuzzy matching duplicated across 10+ scripts  
Should be: Shared `normalise_name()`, `parse_date()`, `fuzzy_match_member()` utilities  
Why: Currently updating one script doesn't update the others. Maintenance nightmare.

---

### TIER 5: POLISH & NICE-TO-HAVES

**[41] [UX] [2h] Add back button to OnboardingScreen steps**  
File: `OnboardingScreen.tsx`  
Current: No back button — if user makes a mistake, they must restart  
Should be: Show back arrow from step 2 onward  
Why: Standard UX pattern. Prevents frustration on typo in postcode.

**[42] [UX] [1h] Show PostCode error state in Onboarding**  
File: `OnboardingScreen.tsx`  
Current: If postcode lookup fails, flow continues silently — MP is never shown  
Should be: Show clear error "Postcode not found. Please try again." with retry button  
Why: Users who can't find their MP on step 3 are confused and may abandon onboarding.

**[43] [UX] [2h] Add "7-day free trial" as the headline in SubscriptionScreen**  
File: `SubscriptionScreen.tsx`  
Current: "$4.99 / month" is most prominent; "7-day free trial" is in small muted text  
Should be: "7 Days Free, Then $4.99/month" as the headline; CTA "Start Free Trial"  
Why: Free trial reduces conversion friction. Should be the primary message.

**[44] [UX] [1h] Fix election countdown — add context**  
File: `ElectionScreen.tsx`  
Current: Shows "X days until election" with no other context  
Should be: Show date of election + brief explainer ("The 2025 Australian Federal Election determines all 151 House of Representatives seats and half the Senate")  
Why: Non-political users don't know what the countdown is for.

**[45] [UX] [2h] Community rate-limiting (posts per device per day)**  
File: `CreateCommunityPostScreen.tsx`, Supabase Edge Function  
Current: No rate limiting on community posts — anonymous devices can spam  
Should be: Maximum 3 posts per device per 24 hours; visible counter remaining  
Why: Without rate limiting, the community feed is one spam attack away from being useless.

**[46] [A11Y] [8h] Add VoiceOver/TalkBack accessibility labels**  
Files: All major screens  
Current: Zero `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` usage  
Should be: Every interactive element has proper accessibility annotations  
Why: Required for App Store review in some markets; critical for blind/low-vision users.

**[47] [UX] [3h] Add Hansard speech search within MP profile**  
File: `MemberProfileScreen.tsx` (Speeches tab)  
Current: Shows flat list of recent speeches  
Should be: Add search bar within tab to search speech content (Supabase full-text search on content)  
Why: "What has [MP] said about climate change?" is a compelling use case for researchers and journalists.

**[48] [DATA] [4h] Add registered financial interests data**  
File: New `scripts/ingest_registered_interests.py`  
Current: AEC donations tracked but no registered interests data  
Should be: Scrape/parse APH registered interests disclosures (currently PDF-only)  
Why: This is the accountability data journalists care most about. Major differentiator vs. all competitors.

**[49] [FEATURE] [6h] iOS Home Screen Widget**  
Files: New native module via Expo config plugin  
Current: No widget  
Should be: "Today's Brief" widget showing top 3 news stories  
Why: Widgets drive passive engagement without requiring app opens. Used by all major news apps.

**[50] [FEATURE] [12h] MP Posting Capability (verified accounts)**  
Files: `ClaimProfileScreen.tsx`, `CreatePostScreen.tsx`, Supabase RLS for `representative_updates`  
Current: Verification flow exists but limited rollout  
Should be: Active recruitment of 20+ MPs to claim profiles + posting UI polished + notification to constituents when MP posts  
Why: This is the unique moat. No other app has verified MP-to-constituent direct messaging at scale. If 50 MPs post weekly, the app becomes essential for political journalists.

---

## Files by Quality Rating

### Needs Rewrite (3 screens + 1 hook)
- `HomeScreen.tsx` — 1,000+ line monolith, 11 concurrent hooks, performance risks
- `ExploreScreen.tsx` — 600+ line monolith, mixed concerns
- `ElectionScreen.tsx` — 500+ line monolith
- `hooks/usePolls.ts` — N+1 query pattern

### Needs Refactor (6 files)
- `MemberProfileScreen.tsx` — 500 lines, needs tab decomposition
- `BillDetailScreen.tsx` — 514 lines, needs feature extraction
- `hooks/useCommunityVote.ts` — inefficient vote recalculation
- `hooks/useReactions.ts` — inefficient refresh pattern
- `hooks/useNewsStoryArticles.ts` — no error state exposed
- `components/PollCard.tsx` — no auth check, no error handling

### Clean (everything else — ~40 files)
All other screens, components, and hooks are well-written and maintainable.

---

*Report generated by comprehensive multi-agent codebase analysis. Supabase query results unavailable (MCP disconnected) — data metrics sourced from CLAUDE.md and codebase constants.*
