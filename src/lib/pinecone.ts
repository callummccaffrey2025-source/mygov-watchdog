import { Pinecone } from "@pinecone-database/pinecone";
const apiKey = process.env.PINECONE_API_KEY!;
if (!apiKey) throw new Error("Missing PINECONE_API_KEY");

export function pinecone() {
  return new Pinecone({ apiKey });
}

export function indexName() {
  return process.env.PINECONE_INDEX || "verity";
}
