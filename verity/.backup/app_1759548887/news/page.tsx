export const revalidate = 300;
export default function News() {
  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-emerald-300 text-3xl font-semibold">Latest political news</h1>
        <p className="mt-2 text-zinc-400">Top headlines curated for context. (Feed coming soon.)</p>
        <div className="mt-8 rounded-2xl border border-zinc-800 p-6 text-zinc-500">
          News feed placeholder — wire your source when ready.
        </div>
      </div>
    </main>
  );
}
