export default function Loading(){
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-6 w-40 bg-zinc-800 rounded mb-6" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({length:6}).map((_,i)=> <div key={i} className="card h-24 animate-pulse" />)}
      </div>
    </main>
  );
}
