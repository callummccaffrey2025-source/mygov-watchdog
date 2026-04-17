"use client";
import { useMemo, useState } from "react";
function diffLines(a:string,b:string){const A=a.split("\n"),B=b.split("\n");const max=Math.max(A.length,B.length);const rows=[] as {a?:string,b?:string,chg:0|1|2}[];for(let i=0;i<max;i++){const av=A[i]??"",bv=B[i]??"";rows.push({a:av,b:bv,chg: av===bv?0: (av&&!bv?1: (bv&&!av?2: (av!==bv?2:0))) });}return rows;}
export default function DiffViewer({ v1, v2 }:{ v1:string; v2:string }){
  const [mode,setMode]=useState<"side"|"unified">("side");
  const rows=useMemo(()=>diffLines(v1,v2),[v1,v2]);
  return(<div className="mt-4">
    <div className="flex items-center gap-3 text-sm">
      <button className="btn" onClick={()=>setMode(m=>m==="side"?"unified":"side")}>Toggle {mode==="side"?"Unified":"Side-by-side"}</button>
    </div>
    {mode==="side"?(
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <pre className="card p-3 overflow-auto text-sm">{rows.map((r,i)=><div key={i} className={r.chg===1?"bg-red-950/40":r.chg===2?"bg-emerald-950/30":""}>{r.a}</div>)}</pre>
        <pre className="card p-3 overflow-auto text-sm">{rows.map((r,i)=><div key={i} className={r.chg===2?"bg-emerald-950/30":r.chg===1?"bg-red-950/40":""}>{r.b}</div>)}</pre>
      </div>
    ):(
      <pre className="card p-3 overflow-auto text-sm mt-3">{rows.map((r,i)=><div key={i} className={r.chg? (r.chg===2?"bg-emerald-950/30":"bg-red-950/40") : ""}>{r.a||r.b}</div>)}</pre>
    )}
  </div>);
}
