const STAGES=["Introduced","First Reading","Second Reading","Committee","Third Reading","Senate","Royal Assent"];
export default function StageTracker({ stage }:{ stage:string }){
  const idx = STAGES.findIndex(s=> stage.toLowerCase().includes(s.toLowerCase()));
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-xs text-neutral-100">
        {STAGES.map((s,i)=>(
          <span key={s} className={"px-2 py-1 rounded border " + (i<=idx?"border-emerald-700/60 text-emerald-300":"border-zinc-800 bg-zinc-900/40")}>{s}</span>
        ))}
      </div>
    </div>
  );
}
