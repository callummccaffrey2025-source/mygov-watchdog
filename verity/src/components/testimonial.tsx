type Item = { quote: string; author: string; role?: string };
export default function Testimonials({ items }: { items: Item[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((t) => (
        <figure key={t.author} className="card p-6">
          <blockquote className="text-neutral-100">“{t.quote}”</blockquote>
          <figcaption className="mt-4 text-sm text-neutral-100">
            <span className="font-medium text-neutral-100">{t.author}</span>
            {t.role ? <> · {t.role}</> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
