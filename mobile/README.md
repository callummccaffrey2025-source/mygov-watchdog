# Verity Mobile — Phase 1

React Native + Expo mobile app for Australian civic intelligence.

## Project structure

```
mobile/
├── lib/supabase.ts          Supabase client (used by the app)
├── scripts/                 Python data ingestion pipeline
│   ├── requirements.txt
│   ├── seed_parties.py
│   ├── ingest_federal_members.py
│   ├── ingest_federal_bills.py
│   ├── ingest_votes.py
│   ├── map_postcodes.py
│   ├── summarise_bills.py
│   └── seed_party_policies.py
└── .env.example
```

The Supabase schema lives in `../verity/supabase/migrations/` (shared with the web app).
The Phase 1 migration is `20260327000001_mobile_phase1.sql`.

---

## Setup

### 1 — Install app dependencies

```bash
cd mobile
npm install
```

### 2 — Environment variables

```bash
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3 — Apply the database migration

```bash
cd ../verity          # the existing web app with supabase/
supabase db push      # or: supabase migration up
```

### 4 — Python ingestion scripts

```bash
cd mobile/scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Fill in SUPABASE_URL, SUPABASE_KEY (service role), ANTHROPIC_API_KEY
```

Run scripts in this order:

```bash
# 1. Seed reference data
python seed_parties.py

# 2. Ingest live data (run after seeding parties)
python ingest_federal_members.py     # ~228 current MPs + Senators
python ingest_federal_bills.py       # recent bills from APH

# 3. Map postcodes (run after electorates are populated)
python map_postcodes.py

# 4. Ingest division votes (run after members + bills)
python ingest_votes.py

# 5. AI summarisation (requires ANTHROPIC_API_KEY)
python summarise_bills.py --dry-run  # preview what will be summarised
python summarise_bills.py --limit 20 # process first 20 bills

# 6. Party policy summaries (requires ANTHROPIC_API_KEY)
python seed_party_policies.py
```

### 5 — Start the app

```bash
npm run ios      # iOS Simulator
npm run android  # Android emulator
npm start        # Expo Go / web
```

---

## Database schema (Phase 1 additions)

| Table | Purpose |
|---|---|
| `members` | Federal MPs and Senators (richer than existing `mps`) |
| `party_policies` | Per-party policy summaries across 8 categories |
| `bill_arguments` | AI-generated for/against arguments per bill |
| `member_votes` | How each member voted on each bill |
| `polls` | Community polls (optionally linked to bills/electorates) |
| `poll_votes` | One vote per user per poll |
| `reactions` | Like/dislike on bills, posts, announcements |
| `announcements` | Government announcements by level/electorate |

Existing tables extended: `parties` (+colour, short_name, level), `electorates` (+postcodes, level), `bills` (+status, summary_plain, categories), `user_preferences` (+postcode, followed_members, etc.)

---

## Notes

- `member_votes` is named to avoid conflict with the existing `votes` (divisions) table in the web schema.
- The `postcodes` column on `electorates` uses a GIN index for fast `@>` array queries.
- All new tables have RLS enabled. Civic reference data is publicly readable. Interactive features (poll_votes, reactions) require authentication.
- `summarise_bills.py` is idempotent — it skips any bill that already has `summary_plain`.
- APH API endpoints are unofficial and may change. Scripts fall back to HTML scraping if the API fails.
