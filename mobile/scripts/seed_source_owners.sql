-- Seed ownership data for major Australian news outlets
-- Data sourced from public corporate filings and ACMA registry (April 2026)

-- Ensure owner column exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'news_sources' AND column_name = 'owner') THEN
    ALTER TABLE news_sources ADD COLUMN owner text;
  END IF;
END $$;

-- ── News Corp Australia ──────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'News Corp Australia' WHERE slug IN (
  'the-australian', 'the-australian-financial-review-opinion',
  'daily-telegraph', 'herald-sun', 'courier-mail', 'the-advertiser',
  'the-mercury', 'ntnews', 'cairns-post', 'townsville-bulletin',
  'geelong-advertiser', 'gold-coast-bulletin', 'sunshine-coast-daily',
  'news-com-au', 'news-com', 'skynews-australia', 'sky-news-australia',
  'the-sunday-telegraph', 'the-sunday-mail', 'the-weekend-australian'
);

-- News Corp patterns
UPDATE news_sources SET owner = 'News Corp Australia'
WHERE owner IS NULL AND (
  name ILIKE '%news.com.au%' OR name ILIKE '%sky news%' OR
  name ILIKE '%the australian%' OR name ILIKE '%daily telegraph%' OR
  name ILIKE '%herald sun%' OR name ILIKE '%courier-mail%' OR
  name ILIKE '%adelaide advertiser%' OR name ILIKE '%the advertiser%' OR
  name ILIKE '%hobart mercury%' OR name ILIKE '%nt news%' OR
  name ILIKE '%cairns post%' OR name ILIKE '%townsville bulletin%'
);

-- ── Nine Entertainment (including former Fairfax) ────────────────────────────

UPDATE news_sources SET owner = 'Nine Entertainment' WHERE slug IN (
  'smh', 'sydney-morning-herald', 'the-age', 'brisbane-times',
  'watoday', 'financial-review', 'afr', 'the-australian-financial-review',
  'nine-news', '9news', 'channel-9', 'a-current-affair', '60-minutes',
  'stuff-co-nz-nine'
);

UPDATE news_sources SET owner = 'Nine Entertainment'
WHERE owner IS NULL AND (
  name ILIKE '%sydney morning herald%' OR name ILIKE '%the age%' OR
  name ILIKE '%brisbane times%' OR name ILIKE '%watoday%' OR
  name ILIKE '%financial review%' OR name ILIKE '%9news%' OR
  name ILIKE '%nine news%'
);

-- ── ABC ──────────────────────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'ABC (Australian Broadcasting Corporation)' WHERE slug IN (
  'abc', 'abc-news', 'abc-news-australia', 'abc-radio', 'abc-rn',
  'radio-national', 'triple-j', 'abc-7-30', 'four-corners', 'abc-insiders'
);

UPDATE news_sources SET owner = 'ABC (Australian Broadcasting Corporation)'
WHERE owner IS NULL AND (
  name ILIKE '%abc news%' OR name ILIKE '%abc.net.au%' OR
  name ILIKE '%radio national%' OR name ILIKE '%triple j%' OR
  name ILIKE '%four corners%' OR name = 'ABC'
);

-- ── SBS ──────────────────────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'SBS (Special Broadcasting Service)' WHERE slug IN (
  'sbs', 'sbs-news', 'nitv', 'sbs-world-news'
);

UPDATE news_sources SET owner = 'SBS (Special Broadcasting Service)'
WHERE owner IS NULL AND (name ILIKE '%sbs%' OR name ILIKE '%nitv%');

-- ── Seven West Media ─────────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'Seven West Media' WHERE slug IN (
  '7news', 'seven-news', 'the-west-australian', 'perthnow', 'the-sunday-times',
  'albany-advertiser', 'broome-advertiser', 'geraldton-guardian', 'kalgoorlie-miner',
  'pilbara-news', 'bunbury-herald', 'augusta-margaret-river-mail'
);

UPDATE news_sources SET owner = 'Seven West Media'
WHERE owner IS NULL AND (
  name ILIKE '%7news%' OR name ILIKE '%seven news%' OR
  name ILIKE '%west australian%' OR name ILIKE '%perthnow%'
);

-- ── Network 10 / Paramount ───────────────────────────────────────────────────

UPDATE news_sources SET owner = 'Paramount / Network 10' WHERE slug IN (
  '10-news', 'network-10', '10-play', 'the-project'
);

UPDATE news_sources SET owner = 'Paramount / Network 10'
WHERE owner IS NULL AND (
  name ILIKE '%10 news%' OR name ILIKE '%network 10%' OR
  name ILIKE '%the project%' OR name ILIKE '%tenplay%'
);

-- ── Australian Community Media ───────────────────────────────────────────────

UPDATE news_sources SET owner = 'Australian Community Media' WHERE slug IN (
  'canberra-times', 'newcastle-herald', 'illawarra-mercury',
  'the-border-mail', 'the-examiner', 'the-advocate-tasmania',
  'bendigo-advertiser', 'the-courier-ballarat', 'warrnambool-standard',
  'western-advocate', 'northern-daily-leader', 'daily-liberal'
);

UPDATE news_sources SET owner = 'Australian Community Media'
WHERE owner IS NULL AND (
  name ILIKE '%canberra times%' OR name ILIKE '%newcastle herald%' OR
  name ILIKE '%illawarra mercury%' OR name ILIKE '%border mail%' OR
  name ILIKE '%the examiner%' OR name ILIKE '%bendigo advertiser%' OR
  name ILIKE '%ballarat courier%' OR name ILIKE '%the advocate%'
);

-- ── Independent / Digital-only ───────────────────────────────────────────────

UPDATE news_sources SET owner = 'Private Media (Crikey)' WHERE slug IN (
  'crikey', 'the-mandarin', 'smart-company', 'inq', 'private-media'
);

UPDATE news_sources SET owner = 'Schwartz Media' WHERE slug IN (
  'the-saturday-paper', 'the-monthly', '7am-podcast', 'the-quarterly-essay'
);

UPDATE news_sources SET owner = 'Guardian Media Group (UK)' WHERE slug IN (
  'the-guardian-australia', 'guardian-australia'
);

UPDATE news_sources SET owner = 'The Conversation Media Group'
WHERE slug = 'the-conversation' OR name ILIKE '%the conversation%';

UPDATE news_sources SET owner = 'Michael West Media Pty Ltd'
WHERE slug = 'michael-west-media' OR name ILIKE '%michael west%';

UPDATE news_sources SET owner = 'Independent Australia Pty Ltd'
WHERE slug = 'independent-australia' OR name ILIKE '%independent australia%';

UPDATE news_sources SET owner = 'Independent'
WHERE slug IN ('the-new-daily', 'pedestrian', 'junkee', 'the-shovel', 'the-betoota-advocate');

UPDATE news_sources SET owner = 'Solstice Media'
WHERE slug IN ('indaily', 'the-adelaide-review', 'solstice-media');

-- ── Wire services ────────────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'Australian Associated Press (AAP)'
WHERE slug IN ('aap', 'aap-newswire') OR name ILIKE '%aap%';

UPDATE news_sources SET owner = 'Reuters' WHERE slug = 'reuters' OR name = 'Reuters';
UPDATE news_sources SET owner = 'Associated Press' WHERE slug = 'ap' OR name ILIKE '%associated press%';

-- ── Specialist / Trade ──────────────────────────────────────────────────────

UPDATE news_sources SET owner = 'InnovationAus Media' WHERE slug = 'innovation-aus' OR name ILIKE '%innovationaus%';
UPDATE news_sources SET owner = 'Sourceable Media Pty Ltd' WHERE slug = 'sourceable';

-- ── Fallback: mark remaining as Independent/Other ────────────────────────────

UPDATE news_sources SET owner = 'Independent / Other'
WHERE owner IS NULL OR owner = '';

-- ── Summary ──────────────────────────────────────────────────────────────────

-- To check ownership coverage after running:
-- SELECT owner, COUNT(*) as outlet_count FROM news_sources GROUP BY owner ORDER BY outlet_count DESC;
