export default function ContextPanel({ title = "Context", text }: { title?: string; text: string; }){
  return (
    <aside className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-1 text-sm font-semibold text-white/80">{title}</h3>
      <p className="text-sm text-white/70">{text}</p>
    </aside>
  );
}
