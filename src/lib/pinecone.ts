import 'server-only';
import { Pinecone } from '@pinecone-database/pinecone';

const indexName = (process.env.PINECONE_INDEX || '').trim();
if (!indexName) throw new Error('PINECONE_INDEX is empty (check env var; no trailing newline)');

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
export const pineconeIndex = pc.index(indexName);
