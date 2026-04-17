#!/usr/bin/env node
import 'node-fetch-polyfill';
import { createClient } from '@supabase/supabase-js';
import { parseStringPromise } from 'xml2js';

const NAME = 'ingest-aph-divisions';
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth:{ persistSession:false }});

function env(k, req=true){ const v=process.env[k]; if(req && !v) throw new Error(`Missing env: ${k}`); return v||''; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function backoff(i){ return Math.min(120000, 500 * 2**i); }

function parseArgs(){
  const a=process.argv.slice(2); const out={ since:null, limit:null, dry:false };
  for (const x of a){
    if (x.startsWith('--since=')) out.since=x.split('=')[1];
    else if (x.startsWith('--limit=')) out.limit=Number(x.split('=')[1]||0)||null;
    else if (x==='--dry' || x==='--dry-run') out.dry=true;
  }
  return out;
}

async function fetchText(url){
  for (let i=0;i<5;i++){
    const res = await fetch(url, { headers: { 'user-agent':'VerityBot/1.0; polite; contact: ops@verity.run' }, cache:'no-store' });
    if (res.ok) return await res.text();
    await sleep(backoff(i));
  }
  throw new Error(`Fetch failed ${url}`);
}

async function fetchRss(url){
  const xml = await fetchText(url);
  const parsed = await parseStringPromise(xml, { explicitArray:false, mergeAttrs:true, trim:true });
  const items = parsed?.rss?.channel?.item || [];
  return Array.isArray(items) ? items : (items ? [items] : []);
}

/** Map House divisions RSS items -> divisions rows */
function mapDivisionItem(it){
  const link = it.link || it.guid || '';
  const title = (it.title||'').replace(/\s+/g,' ').trim();
  const pub = it.pubDate ? new Date(it.pubDate).toISOString() : null;
  const id = String(link || title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  return {
    division: {
      id: `div:${id}`.slice(0,120),
      title,
      chamber: 'House',
      occurred_at: pub,
      bill_id: null,            // can be linked later by scraping detail pages if needed
      source_url: link || null
    }
  };
}

async function upsert(table, rows, conflict){ if (!rows.length) return 0;
  const { error, count } = await supa.from(table).upsert(rows, { onConflict:conflict, count:'exact' });
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

async function logEvent(p){ try { const { error } = await supa.from('ingest_events').insert(p); if (error) console.warn(error.message); } catch(e){} }

async function run(){
  const t0=Date.now();
  const { dry, limit } = parseArgs();
  const strategy=(process.env.APH_DIVISIONS_SOURCE||'RSS').toUpperCase();
  let divisions=[], fetched=0;

  if (strategy==='RSS'){
    const url=env('APH_DIVISIONS_RSS_URL');
    const items = await fetchRss(url);
    const chosen = limit ? items.slice(0, limit) : items;
    for (const it of chosen){
      const { division } = mapDivisionItem(it);
      divisions.push(division);
    }
    fetched = chosen.length;
  } else if (strategy==='PROXY'){
    const url=env('APH_DIVISIONS_PROXY_URL');
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const arr = await res.json();
    for (const d of (Array.isArray(arr)?arr:[])){
      divisions.push({
        id: String(d.id), title: d.title||null, chamber: d.chamber||'House',
        occurred_at: d.occurred_at||null, bill_id: d.bill_id||null, source_url: d.url||d.source_url||null
      });
    }
    fetched = divisions.length;
  } else { throw new Error(`Unknown APH_DIVISIONS_SOURCE=${strategy}`); }

  let upD=0;
  if (!dry){ upD = await upsert('divisions', divisions, 'id'); }

  const ms=Date.now()-t0;
  const summary={ ok:true, name:NAME, strategy, fetched, upserted_divisions:upD, ms, dry };
  await logEvent({ name:NAME, ok:true, fetched, upserted:upD, skipped:Math.max(0,fetched-upD), duration_ms:ms, note:strategy });
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (e)=>{
  await logEvent({ name:NAME, ok:false, fetched:0, upserted:0, skipped:0, duration_ms:0, note:e.message });
  console.error(e); process.exit(1);
});
