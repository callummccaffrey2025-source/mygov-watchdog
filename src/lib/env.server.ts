import "server-only";
function req(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`[env] Missing ${name}`);
  return v;
}
export const envServer = {
  OPENAI_API_KEY: req("OPENAI_API_KEY"),
  PINECONE_API_KEY: process.env.PINECONE_API_KEY ?? "",
  PINECONE_INDEX: process.env.PINECONE_INDEX ?? "verity",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};
