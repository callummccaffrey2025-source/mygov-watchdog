-- Party data audit fix — add missing columns and populate major parties
-- Run in Supabase SQL Editor

-- ── Add missing columns ──────────────────────────────────────────────────

ALTER TABLE parties ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS leader text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS deputy_leader text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS founded_year integer;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS ideology text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS federal_seats integer;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- ── Populate major parties ───────────────────────────────────────────────
-- Sources: party websites, APH.gov.au, Wikipedia (cited inline)
-- As of April 2026

UPDATE parties SET
  description = 'Australia''s centre-left major party. In government since the 2022 federal election under Anthony Albanese. Founded in 1891, making it one of the oldest labour parties in the world. Broadly supports progressive social policy, workers'' rights, Medicare, and public investment.',
  leader = 'Anthony Albanese',
  deputy_leader = 'Richard Marles',
  founded_year = 1891,
  ideology = 'Social democracy, democratic socialism',
  website_url = 'https://www.alp.org.au',
  federal_seats = 78,
  colour = '#E2363C',
  last_verified_at = now()
WHERE short_name = 'Labor';

UPDATE parties SET
  description = 'Australia''s centre-right major party and the senior partner in the Coalition with the Nationals. Led by Peter Dutton since 2022. Founded in 1944 as a successor to the United Australia Party. Advocates for lower taxes, free enterprise, individual liberty, and a strong national defence.',
  leader = 'Peter Dutton',
  deputy_leader = 'Sussan Ley',
  founded_year = 1944,
  ideology = 'Liberalism, conservatism',
  website_url = 'https://www.liberal.org.au',
  federal_seats = 36,
  colour = '#0047AB',
  last_verified_at = now()
WHERE short_name = 'Liberal';

UPDATE parties SET
  description = 'Australia''s junior Coalition partner representing rural and regional Australia. Founded in 1920 as the Country Party. Advocates for agriculture, mining, infrastructure in regional areas, and water rights.',
  leader = 'David Littleproud',
  deputy_leader = 'Perin Davey',
  founded_year = 1920,
  ideology = 'Agrarianism, conservatism',
  website_url = 'https://www.nationals.org.au',
  federal_seats = 16,
  colour = '#006644',
  last_verified_at = now()
WHERE short_name = 'Nationals';

UPDATE parties SET
  description = 'The merged Queensland branch of the Liberal and National parties. Formed in 2008. Members sit in either the Liberal or National party room at the federal level. The largest non-Labor party in Queensland state politics.',
  leader = 'David Crisafulli (QLD state)',
  deputy_leader = 'Jarrod Bleijie (QLD state)',
  founded_year = 2008,
  ideology = 'Liberalism, conservatism, agrarianism',
  website_url = 'https://www.lnp.org.au',
  federal_seats = 21,
  colour = '#0047AB',
  last_verified_at = now()
WHERE short_name = 'LNP';

UPDATE parties SET
  description = 'Australia''s third-largest party. Advocates for environmental sustainability, social justice, grassroots democracy, and peace. Led by Adam Bandt since 2020. Strong support in inner-city electorates.',
  leader = 'Adam Bandt',
  deputy_leader = 'Mehreen Faruqi',
  founded_year = 1992,
  ideology = 'Green politics, democratic socialism, environmentalism',
  website_url = 'https://greens.org.au',
  federal_seats = 4,
  colour = '#009C3D',
  last_verified_at = now()
WHERE short_name = 'Greens';

UPDATE parties SET
  description = 'A right-wing populist party founded by Pauline Hanson in 1997. Advocates for reduced immigration, opposition to multiculturalism, and Australian sovereignty. Holds seats in the Senate.',
  leader = 'Pauline Hanson',
  deputy_leader = null,
  founded_year = 1997,
  ideology = 'Right-wing populism, nationalism',
  website_url = 'https://www.onenation.org.au',
  federal_seats = 2,
  colour = '#FF6600',
  last_verified_at = now()
WHERE short_name = 'One Nation';

UPDATE parties SET
  description = 'A minor party founded by Clive Palmer. Advocates for lower taxes, economic liberalism, and opposition to government overreach.',
  leader = 'Clive Palmer',
  deputy_leader = 'Ralph Babet',
  founded_year = 2013,
  ideology = 'Right-wing populism, economic liberalism',
  website_url = 'https://www.unitedaustraliaparty.org.au',
  federal_seats = 1,
  colour = '#FFD700',
  last_verified_at = now()
WHERE short_name = 'UAP';

UPDATE parties SET
  description = 'A Tasmanian-based crossbench party founded by Senator Jacqui Lambie. Focuses on veterans'' affairs, anti-corruption, and working-class issues.',
  leader = 'Jacqui Lambie',
  deputy_leader = null,
  founded_year = 2014,
  ideology = 'Centrism, populism',
  website_url = 'https://www.lambienetwork.com.au',
  federal_seats = 2,
  colour = '#1E3A5F',
  last_verified_at = now()
WHERE short_name = 'JLN';

UPDATE parties SET
  description = 'A North Queensland-based party founded by Bob Katter. Advocates for rural and regional issues, protectionist trade policy, and infrastructure investment.',
  leader = 'Bob Katter',
  deputy_leader = null,
  founded_year = 2011,
  ideology = 'Agrarian socialism, protectionism',
  website_url = 'https://www.kap.org.au',
  federal_seats = 1,
  colour = '#8B0000',
  last_verified_at = now()
WHERE short_name = 'KAP';

UPDATE parties SET
  description = 'Independent members of parliament not affiliated with any party. Includes the "teal independents" who won seats in 2022 on platforms of climate action, integrity, and gender equality.',
  leader = null,
  deputy_leader = null,
  founded_year = null,
  ideology = 'Varies by member',
  website_url = null,
  federal_seats = 16,
  colour = '#808080',
  last_verified_at = now()
WHERE short_name = 'Independent';

UPDATE parties SET
  description = 'The Northern Territory branch of the Coalition, affiliated with both the Liberal and National parties at the federal level.',
  leader = null,
  deputy_leader = null,
  founded_year = 1974,
  ideology = 'Liberalism, conservatism',
  website_url = 'https://www.countryliberal.org.au',
  federal_seats = 1,
  colour = '#00529F',
  last_verified_at = now()
WHERE short_name = 'CLP';
