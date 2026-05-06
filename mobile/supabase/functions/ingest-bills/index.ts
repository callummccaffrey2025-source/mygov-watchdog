// Supabase Edge Function — ingest-bills
//
// Scrapes APH "Bills before Parliament" listing, then enriches each bill
// from its detail page. Upserts into the `bills` table on aph_id (or
// title match for legacy rows). Idempotent, polite (1.5s delay).
//
// Deploy:
//   supabase functions deploy ingest-bills --project-ref zmmglikiryuftqmoprqm
//
// Schedule (pg_cron, 5am AEST = 19:00 UTC):
//   SELECT cron.schedule('ingest-bills-daily', '0 19 * * *', $$
//     SELECT net.http_post(
//       url := 'https://zmmglikiryuftqmoprqm.supabase.co/functions/v1/ingest-bills',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     );
//   $$);

// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const APH_BASE = 'https://www.aph.gov.au';
const LISTING_URL =
  `${APH_BASE}/Parliamentary_Business/Bills_Legislation/Bills_before_Parliament` +
  `?page={PAGE}&drt=2&drv=7&drvH=7&pnu=48&pnuH=48` +
  `&f=01/01/2022&to=31/12/2026&ps=50&ito=1&q=&bs=1&pbh=1&bhor=1&pmb=1&g=1&st=2`;
const ASSENTED_URL =
  `${APH_BASE}/Parliamentary_Business/Bills_Legislation/Bills_Search_Results` +
  `?page={PAGE}&drt=2&drv=7&drvH=7&pnu=48&pnuH=48` +
  `&ps=50&ito=1&q=&ra=1&bs=0&pbh=0&bhor=0&pmb=0&g=0&st=2`;
const DETAIL_URL =
  `${APH_BASE}/Parliamentary_Business/Bills_Legislation/Bills_Search_Results/Result?bId={ID}`;
const UA = 'Verity-CivicIntelligence/1.0 (https://verity.run; data@verity.run)';
const DELAY_MS = 1500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const STATUS_MAP: Record<string, string> = {
  'before reps': 'introduced',
  'before senate': 'passed_house',
  'before house': 'introduced',
  'before the reps': 'introduced',
  'before the senate': 'passed_house',
  'act': 'royal_assent',
  'not proceeding': 'defeated',
  'negatived': 'defeated',
  'lapsed': 'defeated',
  'withdrawn': 'withdrawn',
  'passed both houses': 'passed_senate',
  'received royal assent': 'royal_assent',
  'assented': 'royal_assent',
};

function normaliseStatus(raw: string): string {
  if (!raw) return 'introduced';
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'introduced';
}

function parseAphDate(raw: string | null): string | null {
  if (!raw) return null;
  raw = raw.trim();
  // "27 Mar 2023" or "01 Apr 2026"
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    January: '01', February: '02', March: '03', April: '04',
    June: '06', July: '07', August: '08', September: '09',
    October: '10', November: '11', December: '12',
  };
  // DD Mon YYYY
  const m = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (m) {
    const mm = months[m[2]];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY
  const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Strip HTML tags, collapse whitespace
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Extract text between a tag pattern — simple but effective for APH's stable HTML
function extractBetween(html: string, start: string, end: string): string | null {
  const i = html.indexOf(start);
  if (i === -1) return null;
  const j = html.indexOf(end, i + start.length);
  if (j === -1) return null;
  return html.slice(i + start.length, j);
}

// ─── Listing page ──────────────────────────────────────────────

interface BillRef {
  billId: string;
  title: string;
}

async function fetchBillListing(urlTemplate: string = LISTING_URL, label: string = 'Bills before Parliament'): Promise<BillRef[]> {
  const all: BillRef[] = [];
  const seen = new Set<string>();
  let page = 1;

  while (true) {
    const url = urlTemplate.replace('{PAGE}', String(page));
    const resp = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!resp.ok) break;
    const html = await resp.text();

    // Extract total on first page
    if (page === 1) {
      const totalMatch = html.match(/TOTAL RESULTS:\s*(\d+)/);
      if (totalMatch) console.log(`${label}: ${totalMatch[1]} total`);
    }

    // Extract bill links from <h4> inside search-filter-results
    // Pattern: <a ... href="...bId=r7475">Title Here</a>
    const linkRe = /href="[^"]*bId=([rs]\d+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    const pageBills: BillRef[] = [];
    while ((match = linkRe.exec(html)) !== null) {
      const billId = match[1];
      const title = stripHtml(match[2]);
      // Only take links inside h4 (bill titles, not Track buttons)
      // The bill title links appear first, dedup handles the rest
      if (!seen.has(billId) && title.length > 10) {
        seen.add(billId);
        pageBills.push({ billId, title });
      }
    }

    if (pageBills.length === 0) break;
    all.push(...pageBills);
    console.log(`${label} page ${page}: ${pageBills.length} bills (total: ${all.length})`);

    if (pageBills.length < 50) break;
    page++;
    await sleep(1000);
  }

  return all;
}

// ─── Detail page ───────────────────────────────────────────────

interface BillDetail {
  aph_id: string;
  title: string;
  bill_type: string | null;
  sponsor: string | null;
  portfolio: string | null;
  summary: string | null;
  current_status: string;
  status_raw: string;
  origin_chamber: string;
  date_introduced: string | null;
  last_updated: string;
  parliament_no: number | null;
  intro_house: string | null;
  intro_senate: string | null;
  passed_house: string | null;
  passed_senate: string | null;
  assent_date: string | null;
  aph_url: string;
  is_live: boolean;
}

function extractDt(html: string, label: string): string | null {
  // Match <dt>Label</dt> followed by <dd>Value</dd>
  const re = new RegExp(`<dt>${label}</dt>\\s*<dd>\\s*([\\s\\S]*?)</dd>`, 'i');
  const m = html.match(re);
  return m ? stripHtml(m[1]) : null;
}

function parseProgress(html: string): Array<{ chamber: string; stage: string; date: string | null }> {
  const progress: Array<{ chamber: string; stage: string; date: string | null }> = [];

  // Find the progress section — inside div#main_0_mainDiv
  const mainDiv = extractBetween(html, 'id="main_0_mainDiv"', 'Documents and transcripts');
  if (!mainDiv) return progress;

  // Find all tables in the progress section
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(mainDiv)) !== null) {
    const tableHtml = tableMatch[1];

    // Extract chamber from thead > th
    const thMatch = tableHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const chamber = thMatch ? stripHtml(thMatch[1]) : 'Unknown';

    // Extract rows from tbody
    const tbody = extractBetween(tableHtml, '<tbody>', '</tbody>');
    if (!tbody) continue;

    const rowRe = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tbody)) !== null) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cells.length >= 2) {
        const stage = stripHtml(cells[0][1]);
        const dateStr = stripHtml(cells[1][1]);
        progress.push({ chamber, stage, date: parseAphDate(dateStr) });
      }
    }
  }

  return progress;
}

async function fetchBillDetail(billId: string): Promise<BillDetail | null> {
  const url = DETAIL_URL.replace('{ID}', billId);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!resp.ok) {
      console.warn(`[${billId}] HTTP ${resp.status}`);
      return null;
    }
    const html = await resp.text();

    // Title — first non-empty <h1>
    const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let title: string | null = null;
    let h1Match;
    while ((h1Match = h1Re.exec(html)) !== null) {
      const t = stripHtml(h1Match[1]);
      if (t.length > 5) { title = t; break; }
    }
    if (!title) {
      console.warn(`[${billId}] No title found`);
      return null;
    }

    // Metadata from <dt>/<dd> pairs
    const billType = extractDt(html, 'Type');
    const origChamber = extractDt(html, 'Originating house') || '';
    const statusRaw = extractDt(html, 'Status') || '';
    const parlNoRaw = extractDt(html, 'Parliament no') || '';

    // Sponsor — from sponsorPanel or dt
    let sponsor = extractDt(html, 'Sponsor\\(s\\)') || extractDt(html, 'Sponsor');
    if (sponsor) sponsor = sponsor.replace(/,\s*$/, '').trim();

    // Portfolio
    const portfolio = extractDt(html, 'Portfolio');

    // Summary — from #main_0_summaryPanel
    let summary: string | null = null;
    const summaryPanel = extractBetween(html, 'id="main_0_summaryPanel"', '</div>');
    if (summaryPanel) {
      const pMatch = summaryPanel.match(/<p>([\s\S]*?)<\/p>/i);
      if (pMatch) summary = stripHtml(pMatch[1]);
    }
    // Fallback: <h2>Summary</h2><p>...</p>
    if (!summary) {
      const summaryH2 = html.match(/>Summary<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
      if (summaryH2) summary = stripHtml(summaryH2[1]);
    }

    // Progress
    const progress = parseProgress(html);

    // Extract dates from progress
    let introHouse: string | null = null;
    let introSenate: string | null = null;
    let passedHouse: string | null = null;
    let passedSenate: string | null = null;
    let assentDate: string | null = null;

    for (const p of progress) {
      const stageLower = (p.stage || '').toLowerCase();
      const chamberLower = (p.chamber || '').toLowerCase();
      if (!p.date) continue;

      if (stageLower.includes('introduced') || stageLower.includes('first time')) {
        if (chamberLower.includes('house') || chamberLower.includes('representative')) {
          introHouse = introHouse || p.date;
        } else if (chamberLower.includes('senate')) {
          introSenate = introSenate || p.date;
        }
      }
      if (stageLower.includes('passed') || stageLower.includes('third reading') || stageLower.includes('agreed')) {
        if (chamberLower.includes('house') || chamberLower.includes('representative')) {
          passedHouse = p.date;
        } else if (chamberLower.includes('senate')) {
          passedSenate = p.date;
        }
      }
      if (stageLower.includes('assent')) {
        assentDate = p.date;
      }
    }

    const dateIntroduced = introHouse || introSenate || (progress[0]?.date ?? null);
    const lastActivity = progress.length > 0 ? progress[progress.length - 1].date : dateIntroduced;
    const originChamber = origChamber.toLowerCase().includes('senate') ? 'senate' : 'house';
    const currentStatus = normaliseStatus(statusRaw);

    return {
      aph_id: billId,
      title,
      bill_type: billType,
      sponsor,
      portfolio,
      summary,
      current_status: currentStatus,
      status_raw: statusRaw,
      origin_chamber: originChamber,
      date_introduced: dateIntroduced,
      last_updated: new Date().toISOString(),
      parliament_no: /^\d+$/.test(parlNoRaw) ? parseInt(parlNoRaw) : null,
      intro_house: introHouse,
      intro_senate: introSenate,
      passed_house: passedHouse,
      passed_senate: passedSenate,
      assent_date: assentDate,
      aph_url: url,
      is_live: currentStatus === 'introduced' || currentStatus === 'passed_house',
    };
  } catch (err: any) {
    console.error(`[${billId}] Fetch error: ${err.message}`);
    return null;
  }
}

// ─── Build row for upsert ──────────────────────────────────────

function buildRow(detail: BillDetail) {
  return {
    aph_id: detail.aph_id,
    title: detail.title,
    summary: detail.summary,
    current_status: detail.current_status,
    origin_chamber: detail.origin_chamber,
    date_introduced: detail.date_introduced,
    last_updated: detail.last_updated,
    aph_url: detail.aph_url,
    bill_type: detail.bill_type,
    sponsor: detail.sponsor,
    portfolio: detail.portfolio,
    parliament_no: detail.parliament_no,
    intro_house: detail.intro_house,
    intro_senate: detail.intro_senate,
    passed_house: detail.passed_house,
    passed_senate: detail.passed_senate,
    assent_date: detail.assent_date,
    is_live: detail.is_live,
  };
}

// ─── Main handler (streaming to avoid idle timeout) ────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Parse request body for mode: "all" includes recently assented bills
  let mode = 'active';
  try {
    const body = await req.json();
    if (body?.mode === 'all') mode = 'all';
  } catch { /* empty body is fine, default to active */ }

  // Use a streaming response so pg_cron / net.http_post doesn't hit
  // the 150s idle timeout while we scrape ~100 bill pages at 1.5s each.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      const startTime = Date.now();
      const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
      const logEntries: Array<{ bill_id: string; action: string; reason: string; created_at: string }> = [];

      try {
        // Step 1: Get active bills listing
        send({ event: 'start', message: 'Fetching Bills before Parliament listing...', mode });
        const bills = await fetchBillListing(LISTING_URL, 'Bills before Parliament');
        if (bills.length === 0) {
          send({ event: 'error', message: 'No bills found in listing' });
          controller.close();
          return;
        }

        // Step 1b: Also fetch recently assented if mode=all
        if (mode === 'all') {
          send({ event: 'fetching_assented' });
          const assented = await fetchBillListing(ASSENTED_URL, 'Recently assented');
          const seen = new Set(bills.map((b) => b.billId));
          for (const b of assented) {
            if (!seen.has(b.billId)) {
              bills.push(b);
              seen.add(b.billId);
            }
          }
          send({ event: 'listing', active: bills.length - assented.length, assented: assented.length, total: bills.length });
        } else {
          send({ event: 'listing', count: bills.length });
        }

        // Step 2: Process each bill
        for (let i = 0; i < bills.length; i++) {
          const { billId, title: listTitle } = bills[i];

          const detail = await fetchBillDetail(billId);
          const now = new Date().toISOString();

          if (!detail || !detail.title) {
            stats.errors++;
            logEntries.push({ bill_id: billId, action: 'error', reason: detail ? 'No title' : 'Fetch failed', created_at: now });
            // Emit progress every 10 bills to keep connection alive
            if ((i + 1) % 10 === 0) send({ event: 'progress', done: i + 1, of: bills.length, ...stats });
            await sleep(DELAY_MS);
            continue;
          }

          // Check if exists — by aph_id first, then title
          let existing: any = null;
          const { data: byAphId } = await supabase
            .from('bills')
            .select('id,aph_id,current_status,passed_house,passed_senate,assent_date')
            .eq('aph_id', billId)
            .limit(1);

          if (byAphId?.length) {
            existing = byAphId[0];
          } else {
            const { data: byTitle } = await supabase
              .from('bills')
              .select('id,aph_id,current_status,passed_house,passed_senate,assent_date')
              .eq('title', detail.title)
              .limit(1);
            if (byTitle?.length) existing = byTitle[0];
          }

          const row = buildRow(detail);

          if (existing) {
            if (
              existing.aph_id === billId &&
              existing.current_status === detail.current_status &&
              existing.passed_house === detail.passed_house &&
              existing.passed_senate === detail.passed_senate &&
              existing.assent_date === detail.assent_date
            ) {
              stats.skipped++;
              logEntries.push({ bill_id: billId, action: 'skip', reason: 'No change', created_at: now });
            } else {
              const { error } = await supabase.from('bills').update(row).eq('id', existing.id);
              if (error) {
                stats.errors++;
                logEntries.push({ bill_id: billId, action: 'error', reason: error.message.slice(0, 200), created_at: now });
              } else {
                stats.updated++;
                logEntries.push({ bill_id: billId, action: 'update', reason: `status=${detail.current_status}`, created_at: now });
              }
            }
          } else {
            const { error } = await supabase.from('bills').insert(row);
            if (error) {
              stats.errors++;
              logEntries.push({ bill_id: billId, action: 'error', reason: error.message.slice(0, 200), created_at: now });
            } else {
              stats.inserted++;
              logEntries.push({ bill_id: billId, action: 'insert', reason: `status=${detail.current_status}`, created_at: now });
            }
          }

          // Emit progress every 10 bills
          if ((i + 1) % 10 === 0 || i === bills.length - 1) {
            send({ event: 'progress', done: i + 1, of: bills.length, ...stats });
          }

          await sleep(DELAY_MS);
        }

        const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

        // Step 3: Write log entries
        if (logEntries.length > 0) {
          for (let i = 0; i < logEntries.length; i += 50) {
            await supabase.from('bill_ingestion_log').insert(logEntries.slice(i, i + 50));
          }
        }

        // Step 4: Write heartbeat
        if (stats.errors < bills.length * 0.5) {
          await supabase.from('pipeline_heartbeats').upsert(
            {
              pipeline_name: 'ingest_federal_bills',
              last_success: new Date().toISOString(),
              bills_processed: stats.inserted + stats.updated + stats.skipped,
              bills_inserted: stats.inserted,
              bills_updated: stats.updated,
              duration_seconds: elapsed,
            },
            { onConflict: 'pipeline_name' },
          );
        }

        send({
          event: 'done',
          duration_seconds: elapsed,
          bills_found: bills.length,
          ...stats,
        });
      } catch (err: any) {
        send({ event: 'error', message: err.message, stats });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  });
});
