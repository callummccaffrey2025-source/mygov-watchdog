export type PageProps = {
  params: Promise<{ collection: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps){
  const { collection } = await params;
  const q = (await searchParams)?.q;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Preview: {collection}</h1>
      {q ? <p className="mt-2 text-sm text-zinc-400">Query: <code>{String(q)}</code></p> : null}
      <div className="mt-4 card p-4 text-sm text-zinc-400">Coming soon.</div>
    </main>
  );
}
