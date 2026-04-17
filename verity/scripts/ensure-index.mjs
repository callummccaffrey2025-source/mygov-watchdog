import { Pinecone } from "@pinecone-database/pinecone";
const name = process.env.VERITY_INDEX_NAME || "verity-index";
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Pick a supported serverless region for your account
const spec = { serverless: { cloud: "aws", region: "us-east-1" } };
// If your account uses a different region, change the region above.

const run = async () => {
  const { indexes = [] } = await pc.listIndexes();
  if (indexes.some(i => i.name === name)) {
    console.log("Index exists:", name);
    return;
  }
  console.log("Creating index:", name);
  await pc.createIndex({ name, dimension: 1536, metric: "cosine", spec });
  console.log("Created:", name);
};
run().catch(e => { console.error(e); process.exit(1); });
