export default function Loading(){
  const Skel = ({h="h-24"}:{h?:string}) => <div className={`card ${h} animate-pulse`} />;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div className="w-40 h-6 bg-zinc-800 rounded" />
        <div className="w-56 h-4 bg-zinc-800 rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({length:6}).map((_,i)=><Skel key={i} />)}
      </div>
    </main>
  );
}
