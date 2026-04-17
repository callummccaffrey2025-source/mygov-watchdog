import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ cluster: string }> }
): Promise<Metadata> {
  const { cluster } = await params;
  const id = cluster;
  const title = "News cluster · " + id;
  const description = "Curated articles with stance signalling.";
  return {
    title,
    description,
    alternates: { canonical: "/news/" + id },
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function Page(
  { params }: { params: Promise<{ cluster: string }> }
){
  const { cluster: _c } = await params;
  const cluster = decodeURIComponent(_c);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">News cluster</h1>
      <p className="mt-2 text-sm text-zinc-400">Cluster id: <code>{cluster}</code></p>
    </main>
  );
}
