# Codebase Inventory

Generated: 2026-05-04 | Prompt 1 of 40-prompt roadmap

Status flags: **KEEP** (active, used), **DELETE** (orphan, safe to remove), **MIGRATE** (needs work before it's correct), **INVESTIGATE** (unclear, needs manual check)

---

## Screens (43 files)

| Screen | In App.tsx Navigator | Status | Notes |
|--------|---------------------|--------|-------|
| AboutScreen | YES | KEEP | |
| ActivityScreen | YES | KEEP | In-app notification center |
| AdminDashboardScreen | NO | DELETE | Never registered in navigator |
| AdminPollsScreen | YES | KEEP | Daily Question admin |
| BillDetailScreen | YES | KEEP | Rebuilt in bills session |
| BillListScreen | YES | KEEP | Rebuilt in bills session |
| ClaimProfileScreen | NO | DELETE | Old MP claim system, removed from nav |
| CommunityPostDetailScreen | YES | KEEP | |
| CommunityScreen | YES (tab via nav) | KEEP | |
| CompareMPsScreen | NO | DELETE | Was in nav, removed. Comment says "removed" |
| CompareScreen | NO | DELETE | Never registered, replaced by CompareMPsScreen which is also removed |
| ContradictionDetailScreen | YES | KEEP | |
| CouncilProfileScreen | YES | KEEP | |
| CreateCommunityPostScreen | YES | KEEP | |
| CreatePostScreen | NO | DELETE | Old official posts system |
| DailyBriefScreen | YES | KEEP | |
| ElectionScreen | NO | DELETE | Replaced by PollsScreen. Not in navigator. |
| ExploreScreen | YES (tab) | KEEP | |
| HeadlineComparisonScreen | NO | DELETE | Never registered in navigator |
| HomeScreen | YES (tab) | KEEP | |
| LocalAnnouncementsScreen | YES | KEEP | |
| ManageTopicsScreen | YES | KEEP | |
| MemberProfileScreen | YES | KEEP | |
| NewsScreen | YES (stack only) | KEEP | Used for stack navigation, not tab |
| NewsScreenV2 | YES (tab) | KEEP | Active tab screen |
| NewsStoryDetailScreen | YES | KEEP | |
| NotificationPreferencesScreen | YES | KEEP | |
| OnboardingScreen | YES (conditional) | KEEP | |
| PartyProfileScreen | YES | KEEP | Redesigned |
| PhoneVerificationScreen | NO (commented out) | DELETE | Deferred, not in navigator |
| PollDetailScreen | YES | KEEP | Rebuilt for published polls |
| PollsScreen | YES (tab) | KEEP | Daily Question + published polls |
| PostDetailScreen | NO | DELETE | Old official posts system |
| PrivacyPolicyScreen | YES | KEEP | |
| ProfileScreen | YES (tab) | KEEP | |
| ProfileScreenV2 | NO | DELETE | Experimental, never registered |
| PromiseTrackerScreen | YES | INVESTIGATE | In nav but feature is deferred per roadmap |
| SavedScreen | YES | KEEP | |
| SubscriptionScreen | YES | KEEP | |
| TermsScreen | YES | KEEP | |
| TopicBillsScreen | YES | KEEP | |
| WriteToMPScreen | YES | KEEP | |
| YourMPScreen | NO | DELETE | Never registered in navigator |

**DELETE count: 11 screens**

---

## Hooks (69 files)

| Hook | Imported By | Status | Notes |
|------|------------|--------|-------|
| useAccountabilityScore | MemberProfileScreen | KEEP | |
| useArticleReadTracker | HomeScreen | KEEP | |
| useAuthGate | Multiple screens | KEEP | |
| useBillDivisions | BillDetailScreen | KEEP | |
| useBillHistory | BillDetailScreen | KEEP | |
| useBills | Multiple | KEEP | |
| useBillSwipe | HomeScreen | KEEP | |
| useBillVotes | NONE | DELETE | Not imported anywhere |
| useBlindspots | ExploreScreen | KEEP | |
| useCivicQuiz | HomeScreen | KEEP | |
| useCommittees | MemberProfileScreen | KEEP | |
| useCommunityPosts | CommunityScreen | KEEP | |
| useCommunityVote | CommunityPostDetailScreen | KEEP | |
| useContradictions | MemberProfileScreen | KEEP | |
| useCouncillors | CouncilProfileScreen | KEEP | |
| useCouncils | ExploreScreen | KEEP | |
| useDailyBrief | HomeScreen, DailyBriefScreen | KEEP | |
| useDataFreshness | NONE | DELETE | Written but never used |
| useDonations | MemberProfileScreen, PartyProfileScreen | KEEP | |
| useElectionInfo | ElectionScreen (deleted) | DELETE | Only used by ElectionScreen |
| useElectorateByPostcode | Multiple | KEEP | |
| useElectorateDemographics | MemberProfileScreen | KEEP | |
| useElectorateTrends | HomeScreen | KEEP | |
| useEngagementScore | ProfileScreen | KEEP | |
| useFollow | Multiple | KEEP | |
| useFollowTheMoney | HomeScreen | KEEP | |
| useFunFact | NONE | DELETE | Not imported |
| useGovernmentContracts | MemberProfileScreen | KEEP | |
| useHansard | MemberProfileScreen | KEEP | |
| useIndividualDonations | MemberProfileScreen | KEEP | |
| useIssues | NONE | DELETE | Not imported |
| useLocalAnnouncements | LocalAnnouncementsScreen | KEEP | |
| useMembers | Multiple | KEEP | |
| useMemberVotes | ExploreScreen | KEEP | |
| useMorningSignal | HomeScreen | KEEP | |
| useNetworkStatus | OfflineBanner | KEEP | |
| useNewsItems | NONE | DELETE | Not imported |
| useNewsStories | Multiple | KEEP | |
| useNewsStoryArticles | NewsStoryDetailScreen | KEEP | |
| useNotifications | ActivityScreen | KEEP | |
| useOfficialPosts | NONE | DELETE | Old official posts, removed |
| useParties | Multiple | KEEP | |
| usePersonalBills | NONE | DELETE | Not imported |
| usePersonalFeed | NONE | DELETE | Not imported (usePersonalisedFeed is the active one) |
| usePersonalisedFeed | HomeScreen, NewsScreenV2 | KEEP | |
| usePersonalRelevance | HomeScreen | KEEP | |
| usePolls | NONE | INVESTIGATE | Old polls hook — check if PollsScreen uses it |
| usePromises | PromiseTrackerScreen | INVESTIGATE | Feature deferred |
| usePublishedPolls | PollsScreen | KEEP | New |
| useReactions | NONE | DELETE | Not imported |
| useRebellionNarrative | MemberProfileScreen | KEEP | |
| useReceiptTelemetry | HomeScreen | KEEP | |
| useRecentDivisions | NONE | DELETE | Not imported |
| useRegisteredInterests | MemberProfileScreen | KEEP | |
| useRelevanceScore | NONE | DELETE | Not imported (usePersonalRelevance is active) |
| useRepresentativeUpdates | NONE | DELETE | Old statements system, removed |
| useSaves | SavedScreen | KEEP | |
| useSittingCalendar | HomeScreen | KEEP | |
| useStateParliament | ExploreScreen | KEEP | |
| useStoryPrimarySources | NewsStoryDetailScreen | KEEP | |
| useStoryTimeline | NewsStoryDetailScreen | KEEP | |
| useSubscription | Multiple | KEEP | |
| useTrackInteraction | NONE | DELETE | Not imported |
| useUserIssues | NONE | DELETE | Not imported |
| useUserProfile | ProfileScreenV2 (deleted), HomeScreen | INVESTIGATE | HomeScreen imports from usePersonalRelevance |
| useVerifiedOfficial | NONE | DELETE | Old verification, removed |
| useVerityPolls | NONE | DELETE | Old user-generated polls |
| useVotes | Multiple | KEEP | |
| useWeeklyPoll | HomeScreen | INVESTIGATE | Used by WeeklyPollCard which is a deferred cleanup item |

**DELETE count: 16 hooks**

---

## Components (45 files)

| Component | Imported By | Status | Notes |
|-----------|------------|--------|-------|
| AccountabilityScore | NONE | DELETE | Not imported by any screen |
| AIDisclaimer | NONE | DELETE | Written but never used in any screen |
| AuthPromptSheet | Multiple | KEEP | |
| BillCard | Multiple | KEEP | Rebuilt |
| BlindspotBadge | NONE | DELETE | Not imported |
| Card | NONE | DELETE | Not imported |
| CategoryChip | ExploreScreen | KEEP | |
| CivicQuizCard | NONE | DELETE | Not imported by screens |
| ContradictionAlert | MemberProfileScreen | KEEP | |
| ContradictionCard | MemberProfileScreen | KEEP | |
| ContradictionShareCard | MemberProfileScreen | KEEP | |
| CoverageBar | NewsStoryDetailScreen | KEEP | |
| ElectorateTrendsCard | NONE | DELETE | Not imported |
| EmptyState | Multiple | KEEP | |
| EnhancedStoryCard | Multiple | KEEP | |
| ErrorBoundary | App.tsx | KEEP | |
| FollowTheMoneyCard | HomeScreen | KEEP | |
| HomeScreenSkeleton | HomeScreen | KEEP | |
| LoadingFact | NONE | DELETE | Not imported |
| MemberCard | Multiple | KEEP | |
| MorningSignalCard | NONE | DELETE | Not imported |
| MPReportShareCard | MemberProfileScreen | KEEP | |
| NewsCardSkeleton | NewsScreenV2 | KEEP | |
| NotificationBanner | App.tsx | KEEP | |
| NotificationPermissionModal | App.tsx | KEEP | |
| OfflineBanner | App.tsx | KEEP | |
| ParliamentSittingBanner | NONE | DELETE | Not imported |
| PartyBadge | Multiple | KEEP | |
| PollCard | NONE | DELETE | Old user polls, not imported |
| PollShareCard | NONE | DELETE | Old user polls, not imported |
| PostCard | NONE | DELETE | Old official posts, not imported |
| ReactionButtons | NONE | DELETE | Not imported |
| RebellionCard | MemberProfileScreen | KEEP | |
| ReceiptsBlock | MemberProfileScreen | KEEP | |
| SearchBar | ExploreScreen | KEEP | |
| ShareCards | Multiple | KEEP | |
| SkeletonLoader | Multiple | KEEP | |
| StatBox | NONE | DELETE | Not imported |
| StatusBadge | Multiple | KEEP | |
| StoryTimeline | NewsStoryDetailScreen | KEEP | |
| ThemedButton | NONE | DELETE | Not imported |
| ThemedText | NONE | DELETE | Not imported (PartyProfileScreen was rewritten) |
| TwoRowCoverageBar | NewsStoryDetailScreen | KEEP | |
| VerityRealityCheck | NewsStoryDetailScreen | KEEP | |
| WeeklyPollCard | HomeScreen | INVESTIGATE | Deferred cleanup item |

**DELETE count: 15 components**

---

## Edge Functions (22 in source, 18 deployed)

| Function | Deployed | Status | Notes |
|----------|----------|--------|-------|
| api-bills | NO | DELETE | Public API never used, not deployed |
| api-members | NO | DELETE | Public API never used, not deployed |
| api-search | NO | DELETE | Public API never used, not deployed |
| api-votes | NO | DELETE | Public API never used, not deployed |
| bill-change-notify | YES | KEEP | Hourly cron |
| contradiction-alert-push | NO | DELETE | Never deployed |
| daily-mp-notification | YES | KEEP | |
| data-quality-check | YES | KEEP | Daily cron |
| delete-account | YES | KEEP | Required by Apple |
| generate-bill-summary | YES | KEEP | Daily cron |
| generate-daily-poll | YES | KEEP | Daily Question generation |
| generate-morning-signal | NO | DELETE | Never deployed, superseded |
| generate-relevance-line | NO | DELETE | Never deployed |
| ingest-contracts | NO | DELETE | Never deployed |
| morning-signal-push | NO | DELETE | Never deployed |
| parliament-sitting-alert | YES | KEEP | |
| track-engagement | YES | KEEP | |
| verify-claim | YES | KEEP | |
| verify-phone-confirm-otp | YES | INVESTIGATE | Deployed but feature deferred |
| verify-phone-send-otp | YES | INVESTIGATE | Deployed but feature deferred |
| vote-on-poll | NO | DELETE | Old user polls, not deployed |
| weekly-digest | YES | INVESTIGATE | Deployed but RESEND_API_KEY not set |

**DELETE count: 9 edge function directories**

---

## Database Tables — Zombie Tables (0 rows, no active use)

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| analysis_jobs | 0 | DELETE | No code references it |
| announcements | 0 | DELETE | No code references it |
| article_reads | 0 | DELETE | Superseded by user_reads |
| australian_mps | 0 | DELETE | Duplicate of members |
| bill_chunks | 0 | DELETE | Never populated |
| bill_forecasts | 0 | DELETE | Never populated |
| bill_opinions | 0 | DELETE | Superseded by bill_arguments |
| bill_sentiment_swipes | 0 | DELETE | Never used |
| claims | 0 | DELETE | Never populated |
| corrections | 0 | DELETE | Never populated |
| cross_aisle_suggestions | 0 | DELETE | Never populated |
| daily_summaries | 0 | DELETE | Superseded by daily_briefs |
| document_chunks | 0 | DELETE | Never populated |
| entities | 0 | DELETE | Never populated |
| factcheck_votes | 0 | DELETE | Never populated |
| headline_comparisons | 0 | DELETE | Never populated |
| ingestion_review_queue | 0 | DELETE | Never populated |
| local_councils | 0 | DELETE | Duplicate of councils (which has 20 rows) |
| member_votes | 0 | DELETE | Superseded by division_votes |
| outlet_credibility_scores | 0 | DELETE | Never populated |
| outlet_predictions | 0 | DELETE | Never populated |
| parliament_live_items | 0 | DELETE | Never populated |
| parliament_news_links | 0 | DELETE | Never populated |
| policies | 0 | DELETE | Superseded by party_policies |
| politician_policies | 0 | DELETE | Never populated |
| politician_views | 0 | DELETE | Never populated |
| poll_votes | 0 | DELETE | Old user-generated poll system |
| post_comments | 0 | DELETE | Old official posts system |
| post_reactions | 0 | DELETE | Old official posts system |
| predictions | 0 | DELETE | Never populated |
| user_alerts | 0 | DELETE | Never populated |
| user_engagement | 0 | DELETE | Superseded by user_engagement_stats |
| user_media_diet | 0 | DELETE | Never populated |
| user_push_tokens | 0 | DELETE | Duplicate of push_tokens |
| user_swipes | 0 | DELETE | Never populated |
| user_watchlists | 0 | DELETE | Never populated |
| users | 0 | DELETE | Duplicate of auth.users |
| verdict_facts | 0 | DELETE | Never populated |
| votes | 0 | DELETE | Superseded by division_votes |
| weekly_poll_votes | 0 | DELETE | Old weekly poll, 0 votes |

**DELETE count: 40 zombie tables**

### Tables with data that are debatable:

| Table | Rows | Status | Notes |
|-------|------|--------|-------|
| bill_electorate_sentiment | 790 | INVESTIGATE | Referenced by anything? |
| donor_influence | 637 | INVESTIGATE | Referenced by anything? |
| entity_extraction_runs | 3 | DELETE | No code references |
| methodology_versions | 1 | DELETE | No code references |
| official_posts | 12 | DELETE | Feature removed |
| poll_options | 45 | DELETE | Old polls system |
| political_risk | 226 | INVESTIGATE | Referenced by anything? |
| politicians | 226 | INVESTIGATE | Parallel to members table |
| profiles | 1 | DELETE | Duplicate of user_profiles |
| sources | 1 | DELETE | Superseded by news_sources |
| story_entities | 8 | DELETE | Minimal data, no UI |
| verity_polls | 9 | DELETE | Old user polls |
| weekly_polls | 1 | DELETE | Old weekly poll |

---

## Cron Jobs (10 active)

| ID | Name | Schedule | Status | Notes |
|----|------|----------|--------|-------|
| 2 | ingest-news-daily | 0 20 * * * | KEEP | 6am AEST, news pipeline |
| 3 | generate-daily-brief-daily | 0 21 * * * | KEEP | 7am AEST |
| 5 | weekly-digest-sun-1800-aest | 0 8 * * 0 | INVESTIGATE | RESEND_API_KEY not set |
| 6 | close-expired-polls | 0 0 * * * | KEEP | Daily Question lifecycle |
| 7 | enrich-bill-narrative | 0 22 * * * | KEEP | Bill enrichment |
| 8 | generate-bill-summaries | 30 22 * * * | KEEP | Bill AI summaries |
| 9 | data-quality-daily | 45 22 * * * | KEEP | Health checks |
| 10 | bill-change-notify-hourly | 17 * * * * | KEEP | Bill follow notifications |
| 11 | expire-phone-verifications | 0 * * * * | DELETE | Phone verification deferred |
| 12 | recompute-poll-aggregates | 0 17 * * * | KEEP | Published polls |

---

## Summary for Prompt 2

| Category | KEEP | DELETE | INVESTIGATE | MIGRATE |
|----------|------|--------|-------------|---------|
| Screens | 30 | 11 | 1 (PromiseTracker) | 0 |
| Hooks | 48 | 16 | 4 | 0 |
| Components | 28 | 15 | 1 (WeeklyPollCard) | 0 |
| Edge Functions (source) | 12 | 9 | 2 (phone verify) | 0 |
| DB Tables (zombie, 0 rows) | — | 40 | — | — |
| DB Tables (debatable) | — | 8 | 5 | — |
| Cron Jobs | 8 | 1 | 1 (weekly-digest) | 0 |

**Total DELETE candidates: 11 screens + 16 hooks + 15 components + 9 edge function dirs + 48 tables + 1 cron = ~100 items to remove in Prompt 2.**
