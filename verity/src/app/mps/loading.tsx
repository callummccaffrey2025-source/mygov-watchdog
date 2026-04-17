export default function Loading(){
  return (
    <div className="p-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({length:2}).map((_,i)=>(
          <div key={i} className="h-24 rounded-2xl bg-zinc-900/50 border border-zinc-800" />
        ))}
      </div>
    </div>
  );
}
