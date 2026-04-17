import Link from "next/link";
type Bill = { id: string; title: string; predictedPass?: number; youFollow?: boolean };
export default function BillListItem({ bill }:{ bill:{ id:string; title:string; predictedPass?:number; stage?:string; updated?:string; youFollow?:boolean }}) {
  const pct = typeof bill.predictedPass === 'number' ? bill.predictedPass : undefined;
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div>
        <div className="font-medium">{bill.title}</div>
     <div className="text-xs text-zinc-400">Status: {bill.stage ?? '—'} • Updated {bill.updated ?? '—'}</div>
        <div className="mt-1 text-xs text-zinc-400">
          {bill.youFollow ? 'You follow this bill' : 'Not following'}
        </div>
      </div>
      <div className="min-w-[160px]">
        <div className="text-xs text-zinc-400">Predicted pass</div>
        <div className="mt-1 h-2 w-40 overflow-hidden rounded-full border border-zinc-800">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
