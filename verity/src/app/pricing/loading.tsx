export default function Loading(){
  return (
    <div className="p-6 animate-pulse">
      <div className="h-7 w-28 rounded bg-zinc-800/60 mb-4" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({length:3}).map((_,i)=>(
          <div key={i} className="h-40 rounded-2xl bg-zinc-900/50 border border-zinc-800" />
        ))}
      </div>
    </div>
  );
}
