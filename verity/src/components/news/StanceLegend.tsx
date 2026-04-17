export default function StanceLegend(){
  return (
    <div className="flex gap-4 text-sm text-zinc-400">
      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Supportive</span>
      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />Critical</span>
      <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-zinc-500" />Neutral</span>
    </div>
  );
}
