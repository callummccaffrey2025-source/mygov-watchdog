import { config } from "dotenv";
config({ path: ".env.local" }); // load .env.local when run from CLI

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

// --- small helpers ---
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}
function chunkText(text: string, maxChars = 1200): string[] {
  const out: string[] = [];
  let p = 0;
  while (p < text.length) {
    const end = Math.min(text.length, p + maxChars);
    let cut = end;
    const dot = text.lastIndexOf(".", end);
    if (dot > p + 200) cut = dot + 1;
    out.push(text.slice(p, cut).trim());
    p = cut;
  }
  return out.filter(Boolean);
}

// --- clients ---
const openai = new OpenAI({ apiKey: req("OPENAI_API_KEY") });
const pinecone = new Pinecone({ apiKey: req("PINECONE_API_KEY") });
const index = pinecone.Index(process.env.PINECONE_INDEX || "verity");

// --- main ---
async function main() {
  const dir = path.resolve("data/seed");
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
    : [];
  if (files.length === 0) throw new Error("No seed files in data/seed");

  for (const f of files) {
    const full = path.join(dir, f);
    const raw = fs.readFileSync(full, "utf8");

    const title = raw.match(/^\#\s*(.+)$/m)?.[1]?.trim() ?? f;
    const url = raw.match(/URL:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const date = raw.match(/DATE:\s*(.+)$/m)?.[1]?.trim() ?? "";
    const chunks = chunkText(raw);

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    await index.upsert(
      emb.data.map((d, i) => ({
        id: `${f}:${i}`,
        values: d.embedding,
        metadata: { title, url, date, text: chunks[i] },
      }))
    );

    console.log(`Upserted ${emb.data.length} vectors from ${f}`);
  }

  console.log("✅ Ingest complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
