"use client";
import { useEffect,useState } from "react";
type Persona="citizen"|"power"|"journalist";
export default function PersonaSwitcher(){
  const [v,setV]=useState<Persona>("citizen");
  useEffect(()=>{const m=document.cookie.match(/(?:^|;\\s*)v_persona=([^;]+)/); if(m?.[1]) setV(decodeURIComponent(m[1]) as Persona);},[]);
  return(<select value={v} onChange={async e=>{const persona=e.currentTarget.value as Persona; setV(persona); await fetch("/api/personalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({persona})}); location.reload();}} className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" title="Persona">
    <option value="citizen">Citizen</option><option value="power">Power User</option><option value="journalist">Journalist</option>
  </select>);
}
