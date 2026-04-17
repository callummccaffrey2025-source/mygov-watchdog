import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import crypto from "node:crypto";

type RecordMetadataValue = string | number | boolean | null; // mirrors Pinecone allowed values
function coerceRecordMetadata(x: unknown): Record<string, string | number | boolean> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDEX_NAME = process.env.VERITY_INDEX_NAME ?? "verity-index";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

/* --- Minimal helpers (inline; no @/lib/chunker) --- */
function stripBoilerplate(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMainText(html: string): string {
  if (!html) return "";
  return stripBoilerplate(html);
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : undefined;
}

function chunkBySentence(text: string, maxChars: number): string[] {
  const sents = (text || "")
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]?\s*/g) || [];

  const out: string[] = [];
  let buf = "";
  for (const s of sents) {
    const candidate = (buf ? buf + " " : "") + s.trim();
    if (candidate.length <= maxChars) {
      buf = candidate;
    } else {
      if (buf) out.push(buf.trim());
      // if a single sentence is huge, hard-wrap by words
      if (s.length > maxChars) {
        let wbuf = "";
        for (const w of s.trim().split(/\s+/)) {
          const tryw = (wbuf ? wbuf + " " : "") + w;
          if (tryw.length <= maxChars) {
            wbuf = tryw;
          } else {
            if (wbuf) out.push(wbuf);
            wbuf = w;
          }
        }
        if (wbuf) out.push(wbuf);
        buf = "";
      } else {
        buf = s.trim();
      }
    }
  }
  if (buf) out.push(buf.trim());
  return out;
}

function clampInt(n: number | undefined, lo = 1400, hi = 4000) {
  const x = Number.isFinite(n) ? (n as number) : lo;
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

/* --- Route handlers --- */
type IngestBody = {
  url?: string;
  title?: string;
  jurisdiction?: string;
  isOfficial?: boolean;
  text?: string;
  chunkChars?: number;
};

export async function GET() {
  return NextResponse.json({ ok: true, route: "ingest", method: "GET" });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as IngestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const { url, title, jurisdiction, isOfficial, text } = body;
    if (!url && !text) {
      return NextResponse.json({ ok: false, error: "Provide 'url' or 'text'." }, { status: 400 });
    }

    // 1) Get text (use provided or fetch & extract)
    let rawHtml = "";
    let docText = (text ?? "").trim();
    if (!docText && url) {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) throw new Error(`Fetch failed ${r.status} ${r.statusText}`);
      rawHtml = await r.text();
      docText = extractMainText(rawHtml);
    }
    if (!docText) {
      return NextResponse.json({ ok: false, error: "No text found to ingest." }, { status: 400 });
    }

    // *** CRITICAL FIX: avoid mixing ?? with || ***
    const usedTitle = (title ?? extractTitle(rawHtml) ?? url ?? "Untitled");

    // 2) Chunk
    const maxChars = clampInt(body.chunkChars, 1400, 4000);
    const chunks = chunkBySentence(docText, maxChars);
    if (chunks.length === 0) {
      return NextResponse.json({ ok: false, error: "Empty after chunking." }, { status: 400 });
    }

    // 3) Embed
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const emb = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: chunks });
    const vectors = emb.data.map(d => d.embedding);

    // 4) Upsert to Pinecone
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.index(INDEX_NAME);

    const baseId = crypto
      .createHash("sha256")
      .update((url ?? usedTitle) + "|" + (jurisdiction ?? "") + "|" + String(!!isOfficial))
      .digest("hex")
      .slice(0, 20);

    const items = vectors.map((values, i) => ({
      id: `${baseId}-${i}`,
      values,
      metadata: {
        url: url ?? null,
        title: usedTitle,
        text: chunks[i],
        jurisdiction: jurisdiction ?? null,
        isOfficial: !!isOfficial,
        chunk: i,
        totalChunks: chunks.length,
        createdAt: new Date().toISOString(),
      } as Record<string, unknown>,
    }));

    await index.namespace(jurisdiction ?? "global").upsert(items.map(it => ({ ...it, metadata: coerceRecordMetadata((it as {metadata?:unknown}).metadata) })));

    return NextResponse.json({ ok: true, upserted: items.length, ids: items.map(i => i.id) });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
  }
}
