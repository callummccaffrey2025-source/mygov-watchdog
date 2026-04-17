"use client";
import type { MPScorecard } from "@/types/metrics.schema";
import Progress from "@/components/ui/Progress";

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="text-white/70">{value}/100</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function Spark({ points }: { points: number[] }) {
  const w = 96, h = 32;
  const max = Math.max(...points), min = Math.min(...points);
  const norm = (v: number) => h - ((v - min) / Math.max(1, max - min)) * h;
  const step = w / Math.max(1, (points.length - 1));
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${i * step},${norm(p)}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-80">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function MPScorecard({ m }: { m: MPScorecard }) {
  const delta = m.trend.length >= 2 ? m.trend[m.trend.length-1] - m.trend[m.trend.length-2] : 0;
  const dir = delta > 0 ? "↗︎" : delta < 0 ? "↘︎" : "→";
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-white/60">Accountability score</div>
          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-bold">
              {m.composite}<span className="text-base text-white/50">/100</span>
            </div>
            <div className="text-xs text-white/60">
              {m.peers.house_pct}th pct (House) • {m.peers.party_pct}th pct (Party)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Spark points={m.trend} />
          <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/70">{dir} trend</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Row label="Attendance" value={m.subs.attendance} />
        <Row label="Party loyalty" value={m.subs.party_loyalty} />
        <Row label="Committees" value={m.subs.committees} />
        <Row label="Influence" value={m.subs.influence} />
        <Row label="Responsiveness" value={m.subs.responsiveness} />
        <Row label="Integrity" value={m.subs.integrity} />
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <a href="/methodology" className="underline decoration-white/20 underline-offset-2 hover:decoration-white">Methodology</a>
        <span>Updated {new Date(m.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
