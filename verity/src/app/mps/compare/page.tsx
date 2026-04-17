export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const qs = await searchParams; // ids=a,b
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-zinc-100">
      <h1 className="text-xl font-semibold">Compare MPs</h1>
      <p className="mt-2 text-neutral-100">Coming soon — side-by-side attendance, rebellions, vote alignment.</p>
      <div className="mt-3 text-sm text-neutral-100">ids: {qs.ids ?? 'none'}</div>
    </div>
  );
}
