export default function Today() {
  const items = [
    { title: "News receipts", body: "Top 5 stories parsed with bias bars." },
    { title: "Bill activity", body: "Latest AU bills diffed + tracked." },
    { title: "MP spotlight", body: "Attendance, votes, and signals updated daily." },
  ];
  return (
    <main id="today" className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-semibold text-zinc-100">Today’s Coverage</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <article key={it.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-lg font-medium text-zinc-100">{it.title}</h2>
            <p className="mt-2 text-sm text-neutral-100">{it.body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
