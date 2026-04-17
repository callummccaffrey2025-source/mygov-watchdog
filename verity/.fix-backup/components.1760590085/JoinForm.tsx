"use client";
import { Button } from "@/components/ui/button";
import React from "react";
export default function JoinForm(){
  const [email,setEmail] = React.useState("");
  const [msg,setMsg] = React.useState<string|null>(null);
  const [loading,setLoading] = React.useState(false);
  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setMsg(null); setLoading(true);
    try{
      const r = await fetch("/api/subscribe",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error || "Failed");
      setMsg("You're in — thanks for joining Verity!"); setEmail("");
    }catch(e:any){ setMsg(e?.message || "Could not subscribe"); }
    finally{ setLoading(false); }
  }
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3">
      <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none placeholder:text-white/50"
             placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required type="email" />
      <Button disabled={loading} className="w-full">{loading?"Working...":"Get started"}</Button>
      {msg && <div className="text-sm text-white/80">{msg}</div>}
    </form>
  );
}
