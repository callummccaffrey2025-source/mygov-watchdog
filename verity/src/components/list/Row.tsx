export default function Row({ title, meta }: { title:string; meta?:string }){
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-brand/40">
      <div className="font-medium">{title}</div>
      {meta && <div className="text-xs text-white/60 mt-1">{meta}</div>}
    </div>
  );
}
