import { Pinecone } from "@pinecone-database/pinecone";

export function getIndex(name: string) {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("PINECONE_API_KEY is missing");
  const pc = new Pinecone({ apiKey });
  return pc.index(name);
}
