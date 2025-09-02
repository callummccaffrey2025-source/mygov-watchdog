import "server-only";

function req(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(\`[env] Missing \${name}\`);
  return v;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: req("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  OPENAI_API_KEY: req("OPENAI_API_KEY"),
  PINECONE_API_KEY: req("PINECONE_API_KEY"),
  PINECONE_INDEX: process.env.PINECONE_INDEX ?? "verity",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? ""
};
