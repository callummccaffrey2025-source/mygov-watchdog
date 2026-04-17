import Link from "next/link";
import Stat from "@/components/Stat";
import { formatPercent } from "@/lib/format";
import MPCard from "@/components/mp/MPCard";

export type MP = {
  id: string;
  name: string;
  party: string;
  seat?: string;
  attendance?: number;
  alignment?: number;
  reliability?: number;
};

type Props = { items: MP[] };

export default function MPList(props: Props) {
  const { items } = props;

  if (!Array.isArray(items) || items.length === 0) {
    return <div className="text-sm text-zinc-400">No MPs found.</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((m) => (
        <li key={m.id} className="card p-4">
          {/* existing MP card */}
          <div data-testid="mp-header" className="mb-2">
        <div className="text-base font-semibold">{m.name}</div>
        <div className="text-xs text-zinc-400">{m.party}{m.seat ? (" · " + m.seat) : ""}</div>
     </div>
          {/* stats row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Attendance" value={formatPercent(m.attendance)} />
            <Stat label="Alignment" value={formatPercent(m.alignment)} />
            <Stat label="Reliability" value={formatPercent(m.reliability)} />
          </div>
          <Link
            href={`/mps/${m.id}`}
            className="mt-3 inline-flex items-center text-sm text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
          >
            View profile →
          </Link>
        </li>
      ))}
    </ul>
  );
}
