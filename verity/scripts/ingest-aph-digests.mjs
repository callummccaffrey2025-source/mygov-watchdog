import 'node-fetch-polyfill';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { parseStringPromise as parseXML } from 'xml2js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !srk) { console.error('Missing Supabase env'); process.exit(1); }
const sb = createClient(url, srk);

const FEED = 'https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eFirst;page=0;query=Date%3AthisYear%20Dataset%3Abillsdgs;resCount=100';

const xml = await (await fetch(FEED)).text();
const feed = await parseXML(xml, { explicitArray:false });
const items = (feed.rss?.channel?.item || []).map(i => ({
  title: i.title,
  source: 'APH Bills Digest',
  url: i.link,
}));

if (!items.length) { console.log('No items'); process.exit(0); }

const { error } = await sb.from('news_articles')
  .upsert(items.map(x => ({ ...x })), { onConflict: 'url' });
if (error) { console.error('Upsert error', error); process.exit(1); }
console.log(`Upserted ${items.length} digests`);
