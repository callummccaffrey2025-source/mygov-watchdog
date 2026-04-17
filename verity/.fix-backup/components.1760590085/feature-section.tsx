type Item = { title: string; body: string };
export default function FeatureSection({ heading, items }: { heading: string; items: Item[] }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">{heading}</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {items.map((f) => (
          <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">{f.title}</div>
            <p className="mt-2 text-neutral-100">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
