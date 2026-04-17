export default function FAQ({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-4">
      {items.map((x) => (
        <details key={x.q} className="rounded-lg border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer font-medium">{x.q}</summary>
          <p className="mt-2 text-neutral-100">{x.a}</p>
        </details>
      ))}
    </div>
  );
}
