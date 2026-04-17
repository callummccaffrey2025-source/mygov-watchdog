function Bar({ label, value, pct }: { label: string; value: number; pct?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const p = pct !== undefined ? Math.max(0, Math.min(100, pct)) : undefined;
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm">
      <div className="text-white/80">{label}</div>
      <div className="relative h-2.5 rounded bg-white/10" role="img" aria-label={`${label} ${value}/100${p!==undefined?`, ${p}th percentile`:''}`}>
        <div className="h-2.5 rounded bg-white/60" style={{ width: `${v}%` }} />
        {p !== undefined ? (
          <div className="absolute inset-y-0" style={{ left: `${p}%` }}>
            <div className="h-2.5 w-[2px] bg-white/60" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CompareRow({
  subs, peers,
}: {
  subs: { attendance:number; party_loyalty:number; committees:number; influence:number; responsiveness:number; integrity:number };
  peers: { house_pct:number; party_pct:number };
}) {
  return (
    <div className="space-y-3">
      <Bar label="Attendance" value={subs.attendance} pct={peers.house_pct} />
      <Bar label="Party loyalty" value={subs.party_loyalty} pct={peers.party_pct} />
      <Bar label="Responsiveness" value={subs.responsiveness} pct={peers.house_pct} />
      <Bar label="Integrity" value={subs.integrity} pct={peers.house_pct} />
    </div>
  );
}
