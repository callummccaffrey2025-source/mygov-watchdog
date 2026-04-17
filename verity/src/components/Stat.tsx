export default function Stat({label,value}:{label?:string;value?:string|number}) {
  return <div className="text-sm text-neutral-300"><span className="text-neutral-500 mr-2">{label ?? "Stat"}</span><span className="font-medium">{value ?? "—"}</span></div>;
}
