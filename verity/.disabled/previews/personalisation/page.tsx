import { getPersona, type Persona } from "@/lib/persona";
import PreviewCard from "@/components/PreviewCard";
const CARDS: Record<Persona, { title:string; subtitle?:string; href:string; meta?:Record<string,string|number> }[]> = {
  citizen: [
    { title:"Daily Briefing", subtitle:"Top 5 facts in 60s", href:"/briefings/budget-2025", meta:{ layout:"simple" }},
    { title:"Bills Today", subtitle:"What’s moving", href:"/bills", meta:{ filters:"auto" }},
    { title:"Find Your MP", subtitle:"Quick lookup", href:"/mps", meta:{ action:"search" }},
  ],
  power: [
    { title:"Bill Diffs", subtitle:"Compare amendments", href:"/bills/compare?a=latest&b=prev", meta:{ view:"diff" }},
    { title:"Amendment Watch", subtitle:"High-impact changes", href:"/bills", meta:{ alerts:"on" }},
    { title:"Roll-call Votes", subtitle:"Track outcomes", href:"/mps", meta:{ export:"csv" }},
  ],
  journalist: [
    { title:"Source Pack", subtitle:"Docs & provenance", href:"/briefings/budget-2025", meta:{ citations:"inline" }},
    { title:"Ownership Map", subtitle:"Media links", href:"/ownership", meta:{ mode:"investigate" }},
    { title:"Fact-check Kit", subtitle:"Claims & evidence", href:"/search", meta:{ tools:6 }},
  ],
};
export const revalidate = 0;
export default async function PersonalisationPreview(){
  const persona = getPersona();
  const items = CARDS[persona];
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Personalisation Preview</h1>
        <div className="text-sm text-neutral-100">Cookie: <code className="bg-zinc-900 px-2 py-1 rounded">v_persona={persona}</code></div>
      </div>
      <p className="text-neutral-100 mt-2">This shows what a <span className="font-medium text-neutral-100">{persona}</span> sees. Use the header switcher to change persona.</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it,i)=> <PreviewCard key={i} {...it} />)}
      </div>
    </div>
  );
}
