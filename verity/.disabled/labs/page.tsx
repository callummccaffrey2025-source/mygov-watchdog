const links = [
  ["Bias Compass™", "/labs/bias-compass"],
  ["Legislation Impact Simulator", "/labs/simulator"],
  ["Accountability Heatmaps", "/labs/heatmaps"],
  ["Civic Assistant", "/labs/assistant"],
  ["Receipts Timeline", "/labs/timelines"],
  ["Citizen Petition Engine", "/labs/petitions"],
  ["Global Benchmarks", "/labs/benchmarks"],
  ["MP Influence Score", "/labs/influence"],
  ["Trust Index™", "/labs/trust"],
  ["Verity Vault", "/labs/vault"],
];

export default function Page() {
  const isBlocked = process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_ENABLE_LABS;
  if (isBlocked) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Labs (disabled)</h1>
        <p className="text-zinc-400 text-sm">Enable by setting <code className="px-1 py-0.5 rounded bg-zinc-800">NEXT_PUBLIC_ENABLE_LABS=1</code>.</p>
      </div>
    );
  }
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Labs</h1>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <a className="underline" href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
