import { Pinecone } from "@pinecone-database/pinecone";
const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) throw new Error("Missing PINECONE_API_KEY");
const pc = new Pinecone({ apiKey });
export function getIndex() {
  const name = process.env.PINECONE_INDEX || "verity";
  return pc.index(name); // v2 API
}
