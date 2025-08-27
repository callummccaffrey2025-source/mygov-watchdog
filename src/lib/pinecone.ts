import 'server-only';
import { Pinecone } from '@pinecone-database/pinecone';

// Pinecone v6: constructor only takes apiKey (no environment)
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// v6: index by name only
export const pineconeIndex = pc.index(process.env.PINECONE_INDEX!);
