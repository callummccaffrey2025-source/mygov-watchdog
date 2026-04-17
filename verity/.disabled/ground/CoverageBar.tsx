type Mix={left:number;center:number;right:number};
export default function CoverageBar({mix}:{mix:Mix}){
  const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));
  const L=clamp(mix.left),C=clamp(mix.center),R=clamp(mix.right), total=(L+C+R)||1;
  const lw=(L/total)*100,cw=(C/total)*100,rw=(R/total)*100;
  return(<div aria-label={`Coverage mix — Left ${L}%, Centre ${C}%, Right ${R}%`}>
    <div className="h-2 w-full rounded bg-zinc-800 overflow-hidden border border-zinc-800">
      <div style={{width:`${lw}%`,background:"var(--left)"}} className="h-full inline-block"/>
      <div style={{width:`${cw}%`,background:"var(--center)"}} className="h-full inline-block"/>
      <div style={{width:`${rw}%`,background:"var(--right)"}} className="h-full inline-block"/>
    </div>
    <div className="mt-1 text-[11px] text-zinc-500">Coverage mix · Left {L}% · Centre {C}% · Right {R}%</div>
  </div>);
}
