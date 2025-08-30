import { Pinecone } from "@pinecone-database/pinecone";
let _pc: Pinecone | null = null;
export function getPineconeIndex() {
  if (!_pc) {
    const key = process.env.PINECONE_API_KEY as string | undefined;
    if (!key) throw new Error("PINECONE_API_KEY missing");
    _pc = new Pinecone({ apiKey: key });
  }
  const name = process.env.PINECONE_INDEX as string | undefined;
  if (!name) throw new Error("PINECONE_INDEX missing");
  return _pc.index(name);
}
