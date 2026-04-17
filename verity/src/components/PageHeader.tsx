export default function PageHeader({
  title, subtitle, right
}:{ title:string; subtitle?:string; right?:React.ReactNode }){
  return (
    <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      {right ? <div className="mt-1">{right}</div> : null}
    </div>
  );
}
