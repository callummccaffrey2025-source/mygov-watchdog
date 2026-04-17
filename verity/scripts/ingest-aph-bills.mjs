#!/usr/bin/env node
import 'node-fetch-polyfill';
import { createClient } from '@supabase/supabase-js';
import { JSDOM } from 'jsdom';

const NAME = 'ingest-aph-bills';
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

function env(k, req=true){ const v=process.env[k]; if(req && !v) throw new Error(`Missing env: ${k}`); return v||''; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function backoff(i){ return Math.min(120000, 500 * 2**i); } // capped expo

function parseArgs(){
  const a = process.argv.slice(2); const out = { since:null, limit:null, dry:false };
  for (let i=0;i<a.length;i++){
    const x=a[i]; if (x.startsWith('--since=')) out.since=x.split('=')[1];
    else if (x.startsWith('--limit=')) out.limit=Number(x.split('=')[1]||0)||null;
    else if (x==='--dry-run' || x==='--dry') out.dry=true;
  }
  return out;
}

async function fetchHtml(url){
  for (let i=0;i<5;i++){
    const res = await fetch(url, { headers: { 'user-agent':'VerityBot/1.0; polite; contact: ops@verity.run' }, cache:'no-store' });
    if (res.ok) return await res.text();
    await sleep(backoff(i));
  }
  throw new Error(`Failed to fetch ${url}`);
}

/** Map APH Senate/House bills list HTML (fallback Strategy A: SCRAPE) */
function mapBillsFromBillsList(html, sourceUrl){
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  // Very conservative: find any bill cards/rows with title and latest status/date
  const rows = Array.from(doc.querySelectorAll('table tr, .bills-list-item, li')).slice(0,1000);
  const bills=[]; const movements=[];
  for (const r of rows){
    const titleEl = r.querySelector('a') || r.querySelector('.title') || r.querySelector('strong');
    const statusEl = r.querySelector('.status, .stage, .update, td:nth-child(2)');
    if (!titleEl) continue;
    const title = titleEl.textContent?.trim() || '';
    if (!title) continue;
    const href = titleEl.getAttribute?.('href') || '';
    const chamber = /Senate/i.test(r.textContent||'') ? 'Senate' : (/House/i.test(r.textContent||'') ? 'House' : null);
    // naive id: slug of title (safe fallback — replace later with real stable ids)
    const id = ('bill:' + title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')).slice(0,100);
    const statusTxt = statusEl?.textContent?.trim() || '';
    const lastDate = (statusTxt.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/)||[])[1] || null;
    const lastIso = lastDate ? new Date(lastDate).toISOString() : null;

    const bill = {
      id, title, chamber, status: statusTxt || null,
      introduced_at: null,
      last_movement_at: lastIso,
      source_url: href ? new URL(href, sourceUrl).toString() : sourceUrl
    };
    bills.push(bill);

    if (lastIso){
      movements.push({
        id: `${bill.id}:${lastIso}`,
        bill_id: bill.id,
        stage: statusTxt?.split(/\b(Bill|Reading|Assent|Committee)\b/i)?.[0]?.trim() || null,
        status: statusTxt || null,
        occurred_at: lastIso,
        source_url: bill.source_url
      });
    }
  }
  return { bills, movements };
}

async function upsert(table, rows, conflict){ if (!rows.length) return 0;
  const { error, count } = await supa.from(table).upsert(rows, { onConflict: conflict, count:'exact' });
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

async function getCursor(name){
  const { data, error } = await supa.from('ingest_cursors').select('since').eq('name', name).maybeSingle();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data?.since || null;
}
async function setCursor(name, since){
  const { error } = await supa.from('ingest_cursors').upsert({ name, since, updated_at: new Date().toISOString() }, { onConflict:'name' });
  if (error) throw new Error(error.message);
}
async function logEvent(payload){
  try { const { error } = await supa.from('ingest_events').insert(payload); if (error) console.warn('[ingest_events]', error.message); }
  catch(e){ console.warn('[ingest_events] threw', e?.message||e); }
}

async function run(){
  const t0 = Date.now();
  const { dry } = parseArgs();
  const strategy = (process.env.APH_BILLS_SOURCE||'SCRAPE').toUpperCase();

  let bills=[], movements=[], fetched=0, note=strategy;

  if (strategy === 'SCRAPE'){
    const url = env('APH_BILLS_URL');
    const html = await fetchHtml(url);
    const mapped = mapBillsFromBillsList(html, url);
    bills = mapped.bills;
    movements = mapped.movements;
    fetched = bills.length;
  } else if (strategy === 'PROXY') {
    const url = env('APH_BILLS_PROXY_URL');
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    const arr = await res.json();
    fetched = Array.isArray(arr) ? arr.length : 0;
    for (const x of (arr||[])){
      bills.push({
        id: String(x.id), title: String(x.title||''), chamber: x.chamber||null, status: x.status||null,
        introduced_at: x.introduced_at||null, last_movement_at: x.last_movement_at||null, source_url: x.url||x.source_url||null
      });
      if (x.movements) for (const m of x.movements){
        if (!m?.occurred_at) continue;
        const mid = `${x.id}:${m.occurred_at}`;
        movements.push({ id: mid, bill_id: String(x.id), stage: m.stage||null, status: m.status||null, occurred_at: m.occurred_at, source_url: m.url||x.url||null });
      }
    }
  } else {
    throw new Error(`Unknown APH_BILLS_SOURCE=${strategy}`);
  }

  let upB=0, upM=0;
  if (!dry){
    upB = await upsert('bills', bills, 'id');
    if (movements.length) upM = await upsert('bill_movements', movements, 'id');
    await setCursor(NAME, new Date().toISOString());
  }

  const ms = Date.now()-t0;
  const summary = { ok:true, name:NAME, strategy, fetched, upserted_bills:upB, upserted_movements:upM, ms, dry };
  await logEvent({ name:NAME, ok:true, fetched, upserted:(upB+upM), skipped:Math.max(0,fetched-(upB+upM)), duration_ms:ms, note:strategy });
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (e)=>{
  await logEvent({ name:NAME, ok:false, fetched:0, upserted:0, skipped:0, duration_ms:0, note:e.message });
  console.error(e);
  process.exit(1);
});
