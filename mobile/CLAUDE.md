# Verity — Australian Civic Intelligence App

## Tech Stack
- React Native / Expo SDK 55 / TypeScript
- Supabase backend: https://zmmglikiryuftqmoprqm.supabase.co
- Bundle ID: au.com.verity.app
- Python ingestion scripts in scripts/
- .env contains: SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, TVFY_API_KEY, NEWSAPI_KEY

## What's Built
- 225 federal members (149 House + 76 Senate) with real photos from TheyVoteForYou API
- 6,400+ bills, 1,929 divisions, 140,000+ vote records
- 17 parties, 151 electorates, 20 councils
- Ground News-style news system: NewsAPI + Google News RSS + direct RSS triple ingestion → topic-first clustering → bias tagging → coverage bars. 101 distinct sources. Minimum 5-source threshold.
- Home screen: Your MP card → Stats bar (6.4k/225/17) → Recent Votes → Today's News (TRENDING badges, source counts) → Trending Bills → Daily Brief (Top Stories, Bills to Watch, How It Affects You, Did You Know)
- MP profiles: real photos, party-coloured headers, stats bar, Votes/About/Funding/Posts tabs, rebellion indicators, ministerial_role badge, committee memberships in About tab
- Bill detail: plain English summaries, How Parliament Voted section, Verity Pro upsell
- Explore tab: Verify a Claim (MP search + voting records), search bar, state filter pills, Parties horizontal scroll (Labor/LNP/Liberal/Greens first), Browse by Topic grid
- Vote tab: Federal Election countdown, Your Electorate with MP card, How They Voted on Key Issues (real vote data grouped by topic with progress bars), Compare MPs & Parties
- Party profiles: policy sections by topic, declared donations with top donors and AEC source attribution
- Individual MP donation data: 2,307 records from AEC bulk CSVs (annual returns + election campaigns 2004–2025), 463 matched to current members. Funding tab has Party Funding | Personal Donations segmented control.
- Council profiles: full councillor lists (259 across 20 councils), contact details, population/area stats
- Hansard: 4,780 speeches ingested via OpenAustralia API (date-iteration strategy, 18 sitting days)
- NSW State Parliament: 135 members (LA + LC) + 468 bills live in Explore tab
- Personalised "How It Affects You": rule-based bullets from user's MP's real votes in last 7 days
- Auth: email magic links + Apple Sign-In + browse without signing in
- Subscription: Verity Pro $4.99/mo
- Privacy Policy + Terms of Service screens
- Push notifications: expo-notifications, Expo Push API, `send-notification` Edge Function (targets: all/electorate/member/token), `notification_preferences` with 7 types, first-run permission modal (3rd open, 7-day snooze), deep-link routing from notification taps, `generate-daily-brief` fires push after brief creation
- Shareable image cards: react-native-view-shot + expo-sharing; 4 card types (MP vote, news story, MP report card, bill); share buttons on vote rows, news items in HomeScreen + NewsStoryDetailScreen, "Share Report Card" button on MP profiles, BillDetailScreen; `share_events` table for analytics; deep link intentFilters in app.json
- Error boundaries, skeleton loaders, pull-to-refresh on all screens
- **Dark mode**: `context/ThemeContext.tsx` with COLORS_LIGHT/COLORS_DARK; `useTheme()` hook applied to all screens; `ThemedStatusBar` in App.tsx; tab bar colors dynamic; DailyBrief, MPCard, BillDetailScreen sub-components (ChamberBadge/VoteBar), CouncilProfileScreen, SubscriptionScreen all fully themed as of 2026-04-02
- **Electorate Community Feed**: `community_posts`, `community_comments`, `community_votes`, `community_reports` tables; `useCommunityPosts` + `useCommunityVote` hooks; CommunityScreen (tabs: Latest/Top/My Posts) + CommunityPostDetailScreen + CreateCommunityPostScreen; preview card on HomeScreen between Today's News and Trending Bills
- **Browse by Topic**: 14 topics (was 8) — added Indigenous Affairs, Technology, Agriculture, Infrastructure, Foreign Policy, Justice to ExploreScreen, ElectionScreen CATEGORY_KEYWORDS, TopicBillsScreen TOPIC_ICONS
- **Verify a Claim**: VerifyModal upgraded with `useVotes` division-level verdict card (AYE/NO bar, top 3 divisions, disclaimer) above existing raw vote list fallback
- **Compare MPs**: ElectionScreen CompareSection now shows real aye rates, topic breakdown (top 5), committee counts, donation totals when both sides are members (uses `useVotes`, `useIndividualDonations`, `useCommittees`)
- **Write to Your MP**: `WriteToMPScreen` — MP mini-card, subject picker (presets + bill-specific auto-fill), pre-filled letter template, opens system email app via `mailto:` deep link, logs send intent + sentiment to `mp_messages` table (user_id, device_id, member_id, subject, message_preview, sentiment). Entry points: "Write to [name]" button on MemberProfileScreen, contextual "Your MP voted X — tell [name] what you think" row on BillDetailScreen. All 225 active members have APH email addresses (House: `firstname.lastname@aph.gov.au`, Senate: `senator.lastname@aph.gov.au`).

## Ingestion Scripts (~/verity/mobile/scripts/)
- ingest_federal_members.py — TheyVoteForYou API
- ingest_federal_bills.py
- ingest_votes.py — TheyVoteForYou API
- ingest_news.py (--fresh flag) — triple source pipeline
- ingest_aph_profiles.py — scrapes APH for ministerial_role, aph_id, committee_memberships (run to refresh)
- ingest_mp_emails.py — generates APH email addresses for all members and writes to Supabase (dry-run by default, `--write` to commit). All 225 active members now have emails.
- ingest_individual_donations.py --zip-dir /tmp --download — AEC bulk CSV donations
- seed_senators.py
- seed_party_policies_manual.py
- seed_councils.py
- refresh_all.sh

## Known Issues
- APH OpenData API returns 404 — no new 2026 bills until they restore it
- Gear icon on every screen is Expo Go dev overlay — disappears in production builds
- NewsAPI free tier doesn't index Australian paywalled outlets — Google News RSS fills that gap
- Registered interests (APH) are PDF-only and APH URLs restructured — not yet ingested
- 77 members have no aph_id (new 2025 entrants not matched by name fuzzy match)

## Development Rules
- NEVER fabricate MP quotes, votes, or data — real data only
- ALWAYS run `npx tsc --noEmit 2>&1` after making changes to verify zero TypeScript errors
- All ingestion scripts go in scripts/
- Test on iPhone 16e via Expo Go
- The gear icon is Expo Go dev overlay — ignore it, it disappears in production
- When fixing bugs, grep the entire src/ directory first to understand the full scope before changing anything
- Preserve existing functionality when adding new features — don't break what works

## Automation Pipelines (LIVE)
- `ingest-news-daily` — pg_cron jobid 2, `0 20 * * *` (6am AEST), calls `/functions/v1/ingest-news` with service_role key
- `generate-daily-brief-daily` — pg_cron jobid 3, `0 21 * * *` (7am AEST), calls `/functions/v1/generate-daily-brief` with service_role key
- Sequence: news ingested first, brief generated from fresh stories one hour later
- Last run (2026-03-31): 275 articles → 72 new stories from 12 sources; brief created with 5 stories

## Design System (fully enforced)
- `DESIGN.md` — authoritative design spec (brand, colors, typography, spacing, component rules, don'ts)
- `constants/design.ts` — SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS (sm/md/lg)
- `constants/topicColors.ts` — centralised topic color system (15 topics) with helper functions
- `components/Card.tsx` — reusable themed card wrapper
- Dark mode: all screens use `useTheme()` — fully themed
- expo-image replaces react-native Image on HomeScreen, NewsScreen, MemberProfileScreen, MemberCard
- expo-haptics: light impact on follow/unfollow, bookmark, upvote/downvote, reaction
- `decodeHtml()` applied to all database text: article descriptions, story summaries, post bodies, bill summaries, Hansard excerpts, party policies
- `timeAgo()` centralised in `lib/timeAgo.ts` — no inline duplicates
- FlatList optimization: windowSize={5}, maxToRenderPerBatch={10} on all 6 FlatLists

## New Screens & Features (April 2026)
- **DailyBriefScreen**: Full-screen daily brief experience — green header, "What happened", "Your MP's week", "Bills to watch", "One thing to know". Navigable from HomeScreen tappable card + push notification deep link
- **ActivityScreen**: In-app notification center / activity feed — type-specific icons, unread dots, deep links to content, mark read/all read
- **SavedScreen**: Bookmarked items with tabs (All/News/Bills/Votes) — accessible from Profile
- **Personalised feed**: "For You / Trending / Latest" pills on HomeScreen news section — ranked by electorate relevance, topic match, blindspot, recency
- **Universal search**: ExploreScreen now searches MPs + bills + parties + news stories simultaneously with grouped results
- **Bookmark system**: `useSave()` hook + bookmark icons on NewsStoryDetailScreen header. Table: `user_saves`
- **Notification deep links**: Bill, member, news story, AND DailyBrief all supported from push notifications
- News source bias database: 41 sources with bias_score/factuality/owner covering 77% of articles. Coverage bars and factuality badges powered by real metadata
- Sub-agents: `.claude/agents/design-enforcer.md`, `data-auditor.md`, `perf-optimizer.md`

## AI Features (LIVE)
- **News story AI summaries** — 34/34 stories with `article_count >= 5` have neutral 2-3 sentence summaries from Claude Haiku 4.5. Generated by `scripts/generate_ai_summaries.py`. Cost: $0.025 / 34 stories. Re-run after each pipeline.
- **Daily Brief AI** — Edge Function `generate-daily-brief` is wired up with `ANTHROPIC_API_KEY` Supabase secret. Generates 3-section brief (`what_happened[]`, `what_it_means`, `one_thing_to_know`) in `daily_briefs.ai_text`. Triggered daily via pg_cron (jobid 3) at 7am AEST.
- **AI Claim Verification** — VerifyModal in ExploreScreen calls `supabase.functions.invoke('verify-claim', { mpName, claim, votes })`. Edge Function source at `supabase/functions/verify-claim/index.ts`. Falls back silently if Edge Function not deployed. Deploy with: `supabase functions deploy verify-claim --project-ref zmmglikiryuftqmoprqm`

## Managed Agents (~/verity/agents/) — 7 total
- `media-scraper.yaml` — scrapes pm.gov.au + Treasurer + Cabinet sites for real media releases (5am AEST)
- `news-pipeline.yaml` — daily news ingestion + AI summary post-step (6am AEST)
- `content-filter.yaml` — filters non-political content + dedupe + quality (6:30am AEST)
- `daily-brief.yaml` — Edge Function trigger for AI brief (7am AEST)
- `data-monitor.yaml` — health checks logged to pipeline_runs (8am AEST)
- `data-backfill.yaml` — weekly Sunday data gap fill (1am AEST Sunday)
- `weekly-digest.yaml` — "This Week in Australian Politics" digest (Sunday 7pm AEST)
- `README.md` — deployment guide (cron, pg_cron, GitHub Actions, managed runners)
- `scripts/data_monitor.py` — runs 5 health checks: articles_fresh, stories_active, brief_present, bias_coverage, members_active

## Content Integrity (App Store ready)
- **`official_posts` table is real-only**: Every row has a verifiable source URL in `media_urls[0]`. Populated by `scripts/scrape_real_media_releases.py` from pm.gov.au + Treasurer + ministerial sites. Script never fabricates content — skips silently if a site times out or returns no parseable links. 12 verified posts as of 2026-04-09.
- **Non-political news filter**: `hooks/usePersonalisedFeed.ts` exports `isPoliticalStory()` + `filterPoliticalStories()`. Excludes crime blotter, sport, lifestyle, celebrity, weather. Applied to ALL feed modes (For You, Trending, Latest) on HomeScreen so users never see "Man arrested after stealing fuel" in a civic intelligence app.
- **Date format consistency**: All vote, bill, news, post timestamps use `timeAgo()` from `lib/timeAgo.ts` ("2h ago" / "3d ago" / "2w ago"). Header dates ("Wednesday, 9 April 2026") and formal dates (election due, member-since) keep full format.
- **Bill arguments**: 16 bills now have AI-generated For/Against arguments via `scripts/generate_bill_arguments.py`. The "Verity Pro lock" placeholder removed — empty state now reads "Arguments for this bill haven't been compiled yet."

## Cron jobs (local)
- `0 6 * * *` — `~/verity/scripts/verity_autopilot.sh` (news ingest + brief generation + Mac notification)
- `0 2,8,14,20 * * *` — `python scripts/ingest_news.py --fresh` (every 6 hours, keeps freshness window < 6h)

## Data Stats (as of 2026-04-09 evening)
- 2,158 articles (latest 12h fresh), 785 stories, 584 sources
- 42 stories with AI summaries (100% of eligible — pipeline auto-generates new ones)
- 64 bill_arguments rows across 16 bills (AI generated, balanced for/against)
- 12 official_posts (all real, all with verified source URLs)
- Today's brief: Bennelong with full ai_text
- 225 active federal members, 6,400+ bills, 1,929 divisions, 140,000+ vote records

## Current Priorities (in order)
1. App Store submission — icon needs re-export as RGB (no transparency/pre-rounded corners); ascAppId + appleTeamId missing in eas.json
2. Top up Anthropic API credits → re-run `scripts/_backfill_metrics.py` to populate AI summaries for 33 eligible stories
3. Create Supabase tables: `user_saves`, `user_reads`, `user_notifications` (hooks are ready, tables needed)
4. Push notifications: test DailyBrief deep link end-to-end

## Autopilot Mode
- Task queue: AUTOPILOT_TASKS.md
- Run: ./scripts/autopilot.sh [max_tasks]
- Each task is atomic — complete one fully before starting next
- Max 3 tasks per session to prevent context degradation
- Logs written to autopilot_log_*.md files
