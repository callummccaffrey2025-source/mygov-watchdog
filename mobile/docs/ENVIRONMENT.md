# Environment Variables

Canonical reference for all environment configuration in Verity.
Last updated: 2026-05-06 (Prompt 5)

---

## Quick setup

1. Copy `.env.example` to `.env` (or ask a team member for the real `.env`)
2. Run `bash scripts/check_env.sh` to validate
3. For EAS builds, env vars are set in the Expo dashboard (not eas.json)
4. For Edge Functions, secrets are in Supabase Vault

---

## Client-side (React Native / Expo)

These are embedded in the app bundle at build time. `EXPO_PUBLIC_` prefix makes them accessible via `process.env`.

| Variable | Required | Where Set | Used In | Description | How to Obtain |
|----------|----------|-----------|---------|-------------|---------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes (build) | `.env`, EAS dashboard | `lib/supabase.ts` | Supabase project URL | Supabase Dashboard > Settings > API > Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes (build) | `.env`, EAS dashboard | `lib/supabase.ts` | Supabase anonymous/public key (safe to expose) | Supabase Dashboard > Settings > API > anon public key |
| `EXPO_PUBLIC_ADMIN_EMAILS` | No | `.env`, EAS dashboard | `screens/AdminPollsScreen.tsx` | Comma-separated admin emails for Daily Question admin. Falls back to `callummccaffrey2025@gmail.com` | Set manually |

---

## Supabase Edge Functions (Deno)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into every Edge Function. User-managed secrets are set via `supabase secrets set`.

| Variable | Required | Where Set | Used In | Description | How to Obtain |
|----------|----------|-----------|---------|-------------|---------------|
| `SUPABASE_URL` | Yes | Auto-injected | All Edge Functions | Supabase project URL | Auto-managed |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-injected | All Edge Functions | Service role key (full DB access) | Auto-managed |
| `ANTHROPIC_API_KEY` | Yes (prod) | Supabase Vault | `generate-bill-summary`, `generate-daily-poll`, `verify-claim`, `generate-daily-brief` | Claude API key for AI features | Anthropic Console > API Keys |
| `TWILIO_ACCOUNT_SID` | No (deferred) | Supabase Vault | `verify-phone-send-otp`, `verify-phone-confirm-otp` | Twilio account SID for SMS OTP | Twilio Console > Account Info |
| `TWILIO_AUTH_TOKEN` | No (deferred) | Supabase Vault | `verify-phone-send-otp`, `verify-phone-confirm-otp` | Twilio auth token | Twilio Console > Account Info |
| `TWILIO_VERIFY_SERVICE_SID` | No (deferred) | Supabase Vault | `verify-phone-send-otp`, `verify-phone-confirm-otp` | Twilio Verify service SID | Twilio Console > Verify > Services > Verity > Service SID |
| `RESEND_API_KEY` | No (deferred) | Supabase Vault | `weekly-digest` | Resend email API key | Resend Dashboard > API Keys |
| `DIGEST_FROM_EMAIL` | No (deferred) | Supabase Vault | `weekly-digest` | Sender email for weekly digest. Falls back to `Verity <brief@verity.run>` | Set manually after domain verification |

### Auto-managed Vault secrets (do not modify)

These are managed by Supabase infrastructure:

- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWKS`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

---

## Python ingestion scripts (local dev)

All scripts use `load_dotenv()` to read from `.env`. Run from the `mobile/` directory.

| Variable | Required | Where Set | Used In | Description | How to Obtain |
|----------|----------|-----------|---------|-------------|---------------|
| `SUPABASE_URL` | Yes | `.env` | All scripts | Supabase project URL | Same as EXPO_PUBLIC_SUPABASE_URL |
| `SUPABASE_KEY` | Yes | `.env` | All scripts | Supabase service role key (full DB access) | Supabase Dashboard > Settings > API > service_role secret |
| `ANTHROPIC_API_KEY` | Yes (AI scripts) | `.env` | `generate_ai_summaries.py`, `generate_bill_arguments.py`, `find_vote_speech_contradictions.py`, `ingest_news.py`, `scrape_media_scrapegraph.py`, `seed_party_policies.py`, `summarise_bills.py` | Claude API key | Anthropic Console > API Keys |
| `THEYVOTEFORYOU_API_KEY` | Yes (votes) | `.env` | `ingest_bills_aph.py`, `ingest_votes.py`, `monitor_sources.py` | TheyVoteForYou API key | theyvoteforyou.org.au > API > Get API Key |
| `OPENAUSTRALIA_API_KEY` | Yes (hansard) | `.env` | `ingest_hansard.py`, `monitor_sources.py` | OpenAustralia API key | openaustralia.org.au > API |
| `NEWSAPI_KEY` | Yes (news) | `.env` | `ingest_news.py`, `monitor_sources.py` | NewsAPI.org API key | newsapi.org > Get API Key |
| `GNEWS_KEY` | Yes (news) | `.env` | `ingest_news.py` | GNews API key | gnews.io > Dashboard |
| `MEDIASTACK_KEY` | Yes (news) | `.env` | `ingest_news.py` | Mediastack API key | mediastack.com > Dashboard |
| `PINECONE_API_KEY` | No (experimental) | `.env` | `cluster_with_embeddings.py` | Pinecone vector DB key | Pinecone Console > API Keys |
| `PINECONE_HOST` | No (experimental) | `.env` | `cluster_with_embeddings.py` | Pinecone index host URL | Pinecone Console > Indexes > Host |
| `OPENAI_API_KEY` | No (experimental) | `.env` | `cluster_with_embeddings.py` | OpenAI API key for embeddings | platform.openai.com > API Keys |
| `SLACK_WEBHOOK_URL` | No (optional) | `.env` | `ops_alert.py` | Slack incoming webhook for ops alerts | Slack App > Incoming Webhooks |
| `ADMIN_PUSH_TOKEN` | No (optional) | `.env` | `ops_alert.py` | Expo push token for admin alerts | Copy from device logs |

### Accepted aliases

Some scripts accept multiple names for the same value (fallback chains). Both forms work:

| Canonical Name | Alias(es) | Notes |
|----------------|-----------|-------|
| `SUPABASE_KEY` | `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | All refer to the service role key. Vault uses `SUPABASE_SERVICE_ROLE_KEY`. |
| `SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` | Scripts try both. |
| `THEYVOTEFORYOU_API_KEY` | `TVFY_API_KEY` | `ingest_votes.py` uses `TVFY_API_KEY`; others use the full name. |

---

## EAS Build environment

The Expo EAS build system uses env vars set in the **Expo dashboard** (not in eas.json). Required for production builds:

| Variable | Set In | Status |
|----------|--------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | EAS dashboard | Done |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS dashboard | Done |

---

## Supabase Vault management

```bash
# List all secrets
supabase secrets list --project-ref zmmglikiryuftqmoprqm

# Set a secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref zmmglikiryuftqmoprqm

# Unset a secret
supabase secrets unset RESEND_API_KEY --project-ref zmmglikiryuftqmoprqm
```

---

## Security notes

- `.env` is gitignored and must NEVER be committed
- `EXPO_PUBLIC_*` values are embedded in the app bundle and visible to users — only put public keys here
- `SUPABASE_KEY` in `.env` is the **service role key** — it bypasses RLS. Never expose it client-side.
- The anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) is safe to expose — it's rate-limited and RLS-protected
- Edge Function secrets are stored in Supabase Vault (encrypted at rest)
