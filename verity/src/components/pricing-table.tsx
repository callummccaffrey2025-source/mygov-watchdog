type Tier = {
  name: string;
  price: string;
  cta: { href: string; label: string };
  features: string[];
  highlight?: boolean;
};

export default function PricingTable({ tiers }: { tiers: Tier[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      {tiers.map((t) => (
        <div key={t.name} className={`card p-6 ${t.highlight ? "ring-1 ring-emerald-400/40" : ""}`}>
          <div className="text-lg font-semibold text-emerald-300">{t.name}</div>
          <div className="mt-2 text-3xl font-bold">{t.price}</div>
          <ul className="mt-4 space-y-2 text-sm text-neutral-100">
            {t.features.map((f) => <li key={f}>• {f}</li>)}
          </ul>
          <a href={t.cta.href} className="btn-primary mt-6 w-full text-center">{t.cta.label}</a>
        </div>
      ))}
    </div>
  );
}
