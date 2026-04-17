export default function Tag({ children }:{ children: React.ReactNode }){
  return (
    <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-300" data-ui="tag">
      {children}
    </span>
  );
}
