export default function Testimonials() {
  const items = [
    { name: "Samir K.", role: "Constituent", quote: "Best way to follow bills." },
  ];
  return (
    <section className="mt-14">
      <h2 className="text-lg font-medium text-zinc-100">What people say</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map((t) => (
          <figure key={t.name} className="rounded-xl border border-zinc-800 p-4">
            <blockquote className="text-zinc-200">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-2 text-sm text-zinc-500">— {t.name}, {t.role}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
