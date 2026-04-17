export default function MediaCompare() {
  const frames = [
    'Outlet A: "Bold climate push."',
    'Outlet B: "Costly power gamble."',
    'Outlet C: "Jobs vs bills debate."',
    'Outlet D: "Net-zero path clarified."',
  ];
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h4 className="font-semibold">How media framed today’s energy policy</h4>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-100">
        {frames.map(t => <div key={t} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">{t}</div>)}
      </div>
    </article>
  );
}
