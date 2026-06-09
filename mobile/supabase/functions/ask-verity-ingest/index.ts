import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * ask-verity-ingest — Chunks and embeds political data into civic_embeddings.
 *
 * Uses Supabase built-in gte-small (384-dim) for embeddings — no external API key.
 *
 * POST { source_type: string, limit?: number, offset?: number }
 * Source types: bill, speech, donation, government_contract, registered_interest,
 *              mp_record, party_platform, vote
 */

const CHUNK_MAX_CHARS = 3200; // ~800 tokens at 4 chars/token
const OVERLAP_CHARS = 600;    // ~150 tokens overlap
const BATCH_SIZE = 20;

// @ts-ignore — Supabase.ai is available in Edge Runtime
const aiSession = new Supabase.ai.Session("gte-small");

interface ChunkRow {
  source_type: string;
  source_id: string;
  source_table: string;
  source_url: string | null;
  source_metadata: Record<string, unknown>;
  chunk_index: number;
  chunk_text: string;
}

function chunkText(text: string, maxChars = CHUNK_MAX_CHARS, overlap = OVERLAP_CHARS): string[] {
  if (!text || text.length <= maxChars) return text ? [text.trim()] : [];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: keep the last portion of the previous chunk
      const overlapStart = Math.max(0, current.length - overlap);
      current = current.slice(overlapStart) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function embed(text: string): Promise<number[] | null> {
  try {
    const result = await aiSession.run(text, { mean_pool: true, normalize: true });
    return Array.from(result as Float32Array);
  } catch (e) {
    console.error("Embedding failed:", e);
    return null;
  }
}

// ── Source-specific chunkers ─────────────────────────────────────────────

async function ingestBills(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("bills")
    .select("id, title, summary_plain, expanded_summary, current_status, sponsor, portfolio, categories, aph_url")
    .not("summary_plain", "is", null)
    .order("last_updated", { ascending: false })
    .range(offset, offset + limit - 1);

  const chunks: ChunkRow[] = [];
  for (const bill of (data ?? [])) {
    let text = `Bill: ${bill.title}\n`;
    if (bill.current_status) text += `Status: ${bill.current_status}\n`;
    if (bill.sponsor) text += `Sponsor: ${bill.sponsor}\n`;
    if (bill.portfolio) text += `Portfolio: ${bill.portfolio}\n`;
    text += `\n${bill.summary_plain ?? ""}`;
    if (bill.expanded_summary) text += `\n\n${bill.expanded_summary}`;

    for (const [i, chunk] of chunkText(text).entries()) {
      chunks.push({
        source_type: "bill",
        source_id: bill.id,
        source_table: "bills",
        source_url: bill.aph_url ?? null,
        source_metadata: {
          title: bill.title,
          status: bill.current_status,
          categories: bill.categories ?? [],
          sponsor: bill.sponsor,
        },
        chunk_index: i,
        chunk_text: chunk,
      });
    }
  }
  return chunks;
}

async function ingestSpeeches(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data: entries } = await supabase
    .from("hansard_entries")
    .select("id, member_id, date, debate_topic, excerpt, chamber, source_url")
    .not("excerpt", "is", null)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  // Resolve member names
  const memberIds = [...new Set((entries ?? []).map((e: any) => e.member_id).filter(Boolean))];
  let members: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: mData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", memberIds);
    members = Object.fromEntries(
      (mData ?? []).map((m: any) => [m.id, `${m.first_name} ${m.last_name}`])
    );
  }

  const chunks: ChunkRow[] = [];
  for (const e of (entries ?? [])) {
    const mp = members[e.member_id] ?? "Unknown MP";
    let text = `Parliamentary speech by ${mp}`;
    if (e.debate_topic) text += ` on "${e.debate_topic}"`;
    text += ` (${e.chamber ?? "Parliament"}, ${e.date})\n\n${e.excerpt}`;

    for (const [i, chunk] of chunkText(text).entries()) {
      chunks.push({
        source_type: "speech",
        source_id: e.id,
        source_table: "hansard_entries",
        source_url: e.source_url ?? null,
        source_metadata: { member_name: mp, member_id: e.member_id, date: e.date, topic: e.debate_topic, chamber: e.chamber },
        chunk_index: i,
        chunk_text: chunk,
      });
    }
  }
  return chunks;
}

async function ingestDonations(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("individual_donations")
    .select("id, member_id, donor_name, donor_type, amount, financial_year, recipient_name")
    .order("amount", { ascending: false })
    .range(offset, offset + limit - 1);

  const memberIds = [...new Set((data ?? []).map((d: any) => d.member_id).filter(Boolean))];
  let members: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: mData } = await supabase.from("members").select("id, first_name, last_name").in("id", memberIds);
    members = Object.fromEntries((mData ?? []).map((m: any) => [m.id, `${m.first_name} ${m.last_name}`]));
  }

  return (data ?? []).map((d: any) => {
    const recipient = members[d.member_id] ?? d.recipient_name ?? "Unknown";
    return {
      source_type: "donation" as const,
      source_id: d.id,
      source_table: "individual_donations",
      source_url: null,
      source_metadata: { donor_name: d.donor_name, recipient, amount: Number(d.amount), financial_year: d.financial_year },
      chunk_index: 0,
      chunk_text: `Political donation: ${d.donor_name} donated $${Number(d.amount).toLocaleString("en-AU")} to ${recipient} in financial year ${d.financial_year}.${d.donor_type ? ` Donor type: ${d.donor_type}.` : ""}`,
    };
  });
}

async function ingestContracts(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("government_contracts")
    .select("id, cn_id, agency, description, value, supplier_name, procurement_method, start_date, end_date")
    .order("value", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  return (data ?? []).map((c: any) => {
    const val = c.value ? `$${Number(c.value).toLocaleString("en-AU")}` : "undisclosed value";
    let text = `Government contract (CN ${c.cn_id ?? "N/A"}): ${c.agency ?? "Unknown agency"} awarded ${val} to ${c.supplier_name ?? "unknown supplier"}.`;
    if (c.description) text += ` ${c.description}.`;
    if (c.procurement_method) text += ` Method: ${c.procurement_method}.`;
    if (c.start_date) text += ` Period: ${c.start_date} to ${c.end_date ?? "ongoing"}.`;
    return {
      source_type: "government_contract" as const,
      source_id: c.id,
      source_table: "government_contracts",
      source_url: null,
      source_metadata: { agency: c.agency, supplier: c.supplier_name, value: c.value ? Number(c.value) : null, cn_id: c.cn_id },
      chunk_index: 0,
      chunk_text: text,
    };
  });
}

async function ingestInterests(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("registered_interests")
    .select("id, member_id, category, description, date_registered")
    .range(offset, offset + limit - 1);

  const memberIds = [...new Set((data ?? []).map((r: any) => r.member_id).filter(Boolean))];
  let members: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: mData } = await supabase.from("members").select("id, first_name, last_name").in("id", memberIds);
    members = Object.fromEntries((mData ?? []).map((m: any) => [m.id, `${m.first_name} ${m.last_name}`]));
  }

  return (data ?? []).map((r: any) => {
    const mp = members[r.member_id] ?? "Unknown MP";
    return {
      source_type: "registered_interest" as const,
      source_id: r.id,
      source_table: "registered_interests",
      source_url: null,
      source_metadata: { member_name: mp, category: r.category },
      chunk_index: 0,
      chunk_text: `Registered interest for ${mp}: Category: ${r.category}. ${r.description}${r.date_registered ? ` (Registered: ${r.date_registered})` : ""}`,
    };
  });
}

async function ingestMembers(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("members")
    .select("id, first_name, last_name, chamber, ministerial_role, bio, party_id, electorate_id, email, aph_id")
    .eq("is_active", true)
    .range(offset, offset + limit - 1);

  const partyIds = [...new Set((data ?? []).map((m: any) => m.party_id).filter(Boolean))];
  const electIds = [...new Set((data ?? []).map((m: any) => m.electorate_id).filter(Boolean))];
  let parties: Record<string, string> = {};
  let electorates: Record<string, { name: string; state: string }> = {};

  if (partyIds.length > 0) {
    const { data: pData } = await supabase.from("parties").select("id, name").in("id", partyIds);
    parties = Object.fromEntries((pData ?? []).map((p: any) => [p.id, p.name]));
  }
  if (electIds.length > 0) {
    const { data: eData } = await supabase.from("electorates").select("id, name, state").in("id", electIds);
    electorates = Object.fromEntries((eData ?? []).map((e: any) => [e.id, { name: e.name, state: e.state }]));
  }

  return (data ?? []).map((m: any) => {
    const name = `${m.first_name} ${m.last_name}`;
    const party = parties[m.party_id] ?? "Independent";
    const el = electorates[m.electorate_id] ?? { name: "", state: "" };
    let text = `${name}, Member for ${el.name} (${el.state}), ${party}. Chamber: ${m.chamber}.`;
    if (m.ministerial_role) text += ` Role: ${m.ministerial_role}.`;
    if (m.bio) text += `\n\n${m.bio}`;
    return {
      source_type: "mp_record" as const,
      source_id: m.id,
      source_table: "members",
      source_url: m.aph_id ? `https://www.aph.gov.au/Senators_and_Members/Parliamentarian?MPID=${m.aph_id}` : null,
      source_metadata: { name, party, electorate: el.name, state: el.state, chamber: m.chamber, role: m.ministerial_role },
      chunk_index: 0,
      chunk_text: text,
    };
  });
}

async function ingestPolicies(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data } = await supabase
    .from("party_policies")
    .select("id, party_id, category, summary_plain, source_url")
    .range(offset, offset + limit - 1);

  const partyIds = [...new Set((data ?? []).map((p: any) => p.party_id).filter(Boolean))];
  let parties: Record<string, string> = {};
  if (partyIds.length > 0) {
    const { data: pData } = await supabase.from("parties").select("id, name").in("id", partyIds);
    parties = Object.fromEntries((pData ?? []).map((p: any) => [p.id, p.name]));
  }

  return (data ?? []).map((p: any) => ({
    source_type: "party_platform" as const,
    source_id: p.id,
    source_table: "party_policies",
    source_url: p.source_url ?? null,
    source_metadata: { party: parties[p.party_id] ?? "Unknown", category: p.category },
    chunk_index: 0,
    chunk_text: `${parties[p.party_id] ?? "Unknown party"} policy on ${p.category}:\n\n${p.summary_plain}`,
  }));
}

async function ingestVotes(supabase: any, limit: number, offset: number): Promise<ChunkRow[]> {
  const { data: divisions } = await supabase
    .from("divisions")
    .select("id, name, date, chamber, bill_title, aye_votes, no_votes, source_url")
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  return (divisions ?? []).map((d: any) => {
    let text = `Parliamentary division: "${d.name}" (${d.chamber}, ${d.date}).`;
    if (d.bill_title) text += ` Related bill: ${d.bill_title}.`;
    text += ` Result: ${d.aye_votes} Aye, ${d.no_votes} No.`;
    return {
      source_type: "vote" as const,
      source_id: d.id,
      source_table: "divisions",
      source_url: d.source_url ?? null,
      source_metadata: { name: d.name, date: d.date, chamber: d.chamber, bill_title: d.bill_title, aye: d.aye_votes, no: d.no_votes },
      chunk_index: 0,
      chunk_text: text,
    };
  });
}

// ── Main handler ─────────────────────────────────────────────────────────

const INGESTERS: Record<string, (sb: any, limit: number, offset: number) => Promise<ChunkRow[]>> = {
  bill: ingestBills,
  speech: ingestSpeeches,
  donation: ingestDonations,
  government_contract: ingestContracts,
  registered_interest: ingestInterests,
  mp_record: ingestMembers,
  party_platform: ingestPolicies,
  vote: ingestVotes,
};

Deno.serve(async (req: Request) => {
  // ── Auth: internal/cron only — caller must present the service role key ──
  {
    const __token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!__token || __token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const { source_type, limit = 200, offset = 0 } = await req.json();
  if (!source_type || !INGESTERS[source_type]) {
    return new Response(JSON.stringify({
      error: `Invalid source_type. Must be one of: ${Object.keys(INGESTERS).join(", ")}`,
    }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Chunk source data
    const chunks = await INGESTERS[source_type](supabase, limit, offset);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ ok: true, embedded: 0, message: "No data found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Embed and store in batches
    let embedded = 0;
    let errors = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      const rows = [];
      for (const chunk of batch) {
        const emb = await embed(chunk.chunk_text);
        if (emb) {
          rows.push({ ...chunk, embedding: emb });
          embedded++;
        } else {
          // Store without embedding — can backfill later
          rows.push(chunk);
          errors++;
        }
      }

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("civic_embeddings")
          .upsert(rows, { onConflict: "source_type,source_id,chunk_index", ignoreDuplicates: false });

        if (upsertErr) {
          console.error("Upsert error:", upsertErr.message);
          // Try inserting without the unique constraint (fallback)
          for (const row of rows) {
            await supabase.from("civic_embeddings").upsert(row, {
              onConflict: "source_type,source_id,chunk_index",
              ignoreDuplicates: false,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      source_type,
      chunks_created: chunks.length,
      embedded,
      embedding_errors: errors,
      offset,
      limit,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Ingest error:", err);
    return new Response(JSON.stringify({
      error: "Ingestion failed",
      detail: err instanceof Error ? err.message : String(err),
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
