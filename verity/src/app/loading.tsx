export default function Loading(){
  return (
    <div className="p-6 animate-pulse">
      <div className="h-7 w-80 rounded bg-zinc-800/60 mb-4" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-40 rounded-2xl bg-zinc-900/50 border border-zinc-800" />
        <div className="h-40 rounded-2xl bg-zinc-900/50 border border-zinc-800" />
      </div>
    </div>
  );
}
