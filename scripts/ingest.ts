import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "verity";
if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
if (!PINECONE_API_KEY) throw new Error("Missing PINECONE_API_KEY");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pc.index(PINECONE_INDEX);

function chunkText(text: string, maxChars = 1200): string[] {
  const out: string[] = []; let p = 0;
  while (p < text.length) {
    const end = Math.min(text.length, p + maxChars);
    let cut = end, dot = text.lastIndexOf(".", end);
    if (dot > p + 200) cut = dot + 1;
    out.push(text.slice(p, cut).trim()); p = cut;
  }
  return out.filter(Boolean);
}

async function main() {
  const dir = path.resolve("data/seed");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".md")) : [];
  if (files.length === 0) throw new Error("No seed files in data/seed");

  for (const f of files) {
    const full = path.join(dir, f);
    const raw = fs.readFileSync(full, "utf8");

    const title = raw.match(/^\\#\\s*(.+)$/m)?.[1]?.trim() ?? f;
    const url   = raw.match(/URL:\\s*(.+)$/m)?.[1]?.trim() ?? "";
    const date  = raw.match(/DATE:\\s*(.+)$/m)?.[1]?.trim() ?? "";
    const chunks = chunkText(raw);

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    const records = emb.data.map((d, i) => ({
      id: \`\${f}:\${i}\`,
      values: d.embedding,
      metadata: { title, url, date, text: chunks[i] },
    }));

    await index.upsert(records);
    console.log(\`Upserted \${records.length} vectors from \${f}\`);
  }
  console.log("✅ Ingest complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
