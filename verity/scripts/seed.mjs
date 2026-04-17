import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
const name = process.env.VERITY_INDEX_NAME || "verity-index";
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const docs = [
  { id: "nsw-energy-rebate-2024", text: "NSW energy rebates 2024–25…", url: "https://www.service.nsw.gov.au" },
  { id: "federal-budget-2024", text: "Australian Federal Budget 2024–25…", url: "https://budget.gov.au" }
];

const run = async () => {
  const index = pc.index(name);
  for (const d of docs) {
    const emb = await openai.embeddings.create({ model: "text-embedding-3-small", input: d.text });
    await index.upsert([{ id: d.id, values: emb.data[0].embedding, metadata: { text: d.text, url: d.url } }]);
    console.log("Upserted", d.id);
  }
};
run().catch(e => { console.error(e); process.exit(1); });
