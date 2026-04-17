import { Pinecone } from "@pinecone-database/pinecone";

let pinecone: Pinecone | null = null;

export function getClient() {
  if (!pinecone) {
    pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return pinecone;
}

export function getIndex(name: string) {
  return getClient().Index(name);
}
