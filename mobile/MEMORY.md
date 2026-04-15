# MEMORY.md — Verity Project Learnings

## Architecture Decisions
- Triple news ingestion (NewsAPI + Google News RSS + direct RSS) chosen because NewsAPI free tier can't index Australian paywalled outlets
- Topic clustering uses 5-source minimum threshold to avoid single-source stories
- TheyVoteForYou API is primary vote data source (140K+ records, 1,929 divisions)
- OpenAustralia API for Hansard (4,780 speeches ingested)
- APH OpenData API returns 404 since early 2026 — do not attempt for bills
- AEC bulk CSVs from transparency.aec.gov.au for donation data (2,307 records)
- APH committee pages scraped for 1,121 committee memberships across 140 committees
- NSW Parliament data: 135 members + 468 bills via parliament.nsw.gov.au
- Supabase Edge Functions for automation: ingest-news, generate-daily-brief, send-notification
- Expo Push API for notifications via send-notification Edge Function

## Data Stats
- 225 federal members (149 House + 76 Senate)
- 6,400+ bills
- 1,929 divisions, 140K+ vote records
- 2,307 individual donation records, 463 matched to current members
- 1,121 committee memberships, 147 members with committees
- 117 members with named roles (27 ministers, 21 shadow ministers, 35 committee chairs)
- 4,780 Hansard speeches
- 135 NSW state members, 468 NSW bills
- 259 councillors across 20 councils
- 101 news sources, 5-source clustering threshold

## Bug Patterns — Always Watch For
- Declare useState variables before referencing them (recentLoading ReferenceError)
- Use optional chaining (?.) on lookup objects (undefined donor type label)
- Clamp percentage values 0-100 before rendering progress bars
- Expo Go gear icon is dev overlay — disappears in production builds
- When deleting hooks/functions, grep entire src/ for remaining references first

## API Quirks
- Google News RSS: URL encode Australian political terms
- NewsAPI: 100 requests/day free tier, 15min delay
- TheyVoteForYou: generous rate limit, paginate at 100
- OpenAustralia API: no auth needed, responses can be large
- AEC transparency portal: bulk CSV downloads, annual update cycle
- Expo Push API: batch 100 notifications per request

## Callum's Workflow
- Non-technical solo founder, builds via Claude Code prompts
- Verifies via iPhone 16e screenshots in Expo Go
- No fabricated data ever — empty states over fake content
- Prefers sequential prompts, one at a time
- Uses Max plan with computer use enabled
- Project at ~/verity/mobile, scripts in scripts/

## Schema — Key Tables
- members: id, first_name, last_name, party_id, electorate_id, chamber, photo_url, is_active, ministerial_role, aph_id
- divisions: id, name, date, chamber, aye_votes, no_votes
- votes: id, member_id, division_id, vote_cast, rebelled
- bills: id, title, current_status, summary_plain, date_introduced, categories, aph_url
- news_stories: id, headline, slug, category, article_count, left_count, center_count, right_count
- push_tokens: id, user_id, token, platform, electorate, member_id, is_active
- notification_preferences: user_id, new_bills, mp_votes, election_updates, local_announcements, daily_brief, breaking_news, weekly_summary
- individual_donations: member_id, donor_name, amount, financial_year
- user_follows: id, user_id, device_id, follow_type ('bill'|'member'|'topic'), follow_id
- user_preferences: id, user_id, device_id, postcode, electorate, member_id, selected_topics, onboarding_completed_at
- share_events: id, content_type, content_id, user_id, created_at

## Development Rules (from CLAUDE.md)
- NEVER fabricate MP quotes, votes, or data — real data only
- ALWAYS run `npx tsc --noEmit 2>&1` after making changes
- All ingestion scripts go in scripts/
- Test on iPhone 16e via Expo Go
- Grep entire src/ before changing anything — understand full scope first
- Preserve existing functionality when adding features

## Patterns & Conventions
- Screen props: `{ navigation }: any` — all screens use this
- Colors: #00843D (Verity green), #1a2332 (dark text), #9aabb8 (muted), #e8ecf0 (border)
- Hooks always return { data, loading } or similar
- SafeAreaView with edges={['top']} wraps every screen
- Share cards: 360×640 ViewShot captured via react-native-view-shot + expo-sharing
- Hidden share card containers use `position: 'absolute', left: -9999`

## Known Issues
- APH OpenData API returns 404 — no new 2026 bills until restored
- 77 members have no aph_id (new 2025 entrants not matched by name)
- Registered interests are PDF-only on APH — not yet ingested
- NewsAPI free tier doesn't index paywalled AU outlets — Google News RSS fills gap

## Automation Pipelines (LIVE, Supabase pg_cron)
- ingest-news-daily: 0 20 * * * (6am AEST) → /functions/v1/ingest-news
- generate-daily-brief-daily: 0 21 * * * (7am AEST) → /functions/v1/generate-daily-brief
- Daily brief fires push notification to all users after creation
